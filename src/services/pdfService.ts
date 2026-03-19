import jsPDF from 'jspdf';
import type { RouteResult, PassengerDetour, RouteOption } from '../types';
import { safeNumber, formatCurrency } from '../utils/numberUtils';
import { CostEngine } from '../core/costEngine';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

import { mapProvider } from '../providers/ProviderManager';

/**
 * Utility to format Date to HH:mm string
 */
const formatTime = (date: Date) => {
  return new Date(date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

/**
 * Utility to format duration minutes to Hh Mmin
 */
const formatDuration = (minutes: number) => {
  const mins = safeNumber(minutes);
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ''}` : `${m}min`;
};

interface TripPDFData {
  trip: any; // Using any to support both Trip (calculator) and TripHistory (database)
  routeResult: RouteResult;
  activeRoute: RouteOption;
}

/**
 * Helper to save PDF in mobile environment
 */
async function saveMobilePDF(doc: jsPDF, filename: string) {
  try {
    const pdfBase64 = doc.output('datauristring').split(',')[1];
    
    // 1. Write to temporary directory
    const fileResult = await Filesystem.writeFile({
      path: filename,
      data: pdfBase64,
      directory: Directory.Cache
    });

    // 2. Share the file (this acts as a "download" on Android/iOS)
    await Share.share({
      title: 'Compartilhar Comprovante',
      text: 'Resumo da Viagem - RachaFácil',
      url: fileResult.uri,
      dialogTitle: 'Onde deseja salvar o PDF?'
    });
  } catch (err) {
    console.error('Capacitor PDF Save Error:', err);
    alert('Erro ao processar PDF no dispositivo. Tente novamente.');
  }
}

export const pdfService = {
  /**
   * Generates a full trip summary PDF
   */
  async generateTripPDF(data: TripPDFData) {
    const { trip, routeResult, activeRoute } = data;
    const isDedicated = routeResult.executionMode === 'DEDICATED';
    const doc = new jsPDF();
    let y = 20;

    // Header
    doc.setFontSize(22);
    doc.setTextColor(20, 20, 20);
    doc.text('Relatório Consolidado de Viagem', 105, y, { align: 'center' });
    y += 10;
    
    doc.setFontSize(14);
    doc.setTextColor(50, 50, 50);
    const modeLabel = isDedicated ? '[MOTORISTA DEDICADO]' : '';
    const tripTitle = trip.shortId ? `ID: ${trip.shortId}` : (trip.tripName && trip.tripName !== 'undefined' ? `Viagem: ${trip.tripName}` : 'Resumo da Viagem');
    doc.text(`${tripTitle} ${modeLabel}`, 105, y, { align: 'center' });
    y += 8;

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 105, y, { align: 'center' });
    y += 10;

    // Map capture using Static Map API
    try {
      const stops = routeResult.orderedPassengers.map(p => p.location.coordinates);
      const mapUrl = mapProvider.getStaticMapUrl(
        routeResult.geometry,
        trip.origin.coordinates,
        trip.destination.coordinates,
        stops,
        600,
        400
      );

      // Fetch the image as a blob
      const response = await fetch(mapUrl);
      if (!response.ok) throw new Error('Failed to fetch static map');
      const blob = await response.blob();
      
      // Convert blob to base64 synchronously for jsPDF
      const mapBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const mapWidth = 170;
      const mapHeight = (400 * mapWidth) / 600; // maintain aspect ratio 600x400
      
      doc.addImage(mapBase64, 'PNG', 20, y, mapWidth, mapHeight);
      y += mapHeight + 15;
    } catch (err) {
      console.error('Failed to capture static map:', err);
    }

    // Section: Resumo da Rota
    doc.setFontSize(16);
    doc.setTextColor(0, 102, 204);
    doc.text('Informações Gerais', 20, y);
    y += 8;
    doc.setDrawColor(0, 102, 204);
    doc.line(20, y, 190, y);
    y += 10;

    doc.setFontSize(11);
    doc.setTextColor(40, 40, 40);
    doc.text(`Origem: ${trip.origin.label}`, 25, y); y += 6;
    doc.text(`Destino Final: ${trip.destination.label}`, 25, y); y += 8;

    // Horários (if scheduled)
    if (routeResult.timeEstimate) {
      doc.setFont('helvetica', 'bold');
      doc.text('Cronograma:', 25, y);
      doc.setFont('helvetica', 'normal');
      doc.text(`Partida: ${formatTime(routeResult.timeEstimate.departureTime)} | Chegada Estimada: ${formatTime(routeResult.timeEstimate.arrivalTime)}`, 55, y);
      y += 8;
    }

    doc.text(`Distância Base (Direta): ${safeNumber(routeResult.baseDistanceKm).toFixed(1)} km`, 25, y); y += 6;
    
    if (isDedicated) {
      doc.text(`Distância de Ida: ${safeNumber(activeRoute.distanceKm).toFixed(1)} km`, 25, y); y += 6;
      doc.text(`Distância de Retorno: ${safeNumber(routeResult.returnDistanceKm).toFixed(1)} km`, 25, y); y += 6;
      doc.setFont('helvetica', 'bold');
      doc.text(`Distância Total Billing: ${(safeNumber(activeRoute.distanceKm) + safeNumber(routeResult.returnDistanceKm)).toFixed(1)} km`, 25, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
    } else {
      doc.text(`Distância com Paradas: ${safeNumber(activeRoute.distanceKm).toFixed(1)} km`, 25, y); y += 6;
    }
    
    doc.text(`Tempo de Trajeto: ${formatDuration(activeRoute.durationMinutes)}`, 25, y); y += 15;

    // Section: Resumo Financeiro
    doc.setFontSize(16);
    doc.setTextColor(0, 102, 204);
    doc.text('Detalhamento Financeiro', 20, y);
    y += 8;
    doc.line(20, y, 190, y);
    y += 10;

    // Unified calculation from the engine with fallbacks to routeResult
    const pureFuelCost = safeNumber(activeRoute.pureFuelCost || routeResult.pureFuelCost, 0);
    const marginAmount = safeNumber(activeRoute.marginAmount || routeResult.marginAmount, 0);
    const totalArrecadado = safeNumber(activeRoute.fuelCost || routeResult.totalCost, 0);

    const kmPerLiter = safeNumber((trip as any).kmPerLiter, 12);
    const fuelPrice = safeNumber((trip as any).fuelPrice, 5.80);

    doc.setFontSize(11);
    doc.text(`Consumo Médio: ${kmPerLiter.toFixed(1)} km/L`, 25, y); y += 6;
    doc.text(`Preço Combustível: ${formatCurrency(fuelPrice)}`, 25, y); y += 10;

    doc.setFont('helvetica', 'bold');
    doc.text(`Custo de Combustível: ${formatCurrency(pureFuelCost)}`, 25, y); y += 6;
    doc.setTextColor(0, 153, 76);
    const computedMarginPct = pureFuelCost > 0 ? Math.round((marginAmount / pureFuelCost) * 100) : 0;
    doc.text(`Margem do Motorista (${computedMarginPct}%): ${formatCurrency(marginAmount)}`, 25, y); y += 8;
    
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text(`TOTAL ARRECADADO: ${formatCurrency(totalArrecadado)}`, 25, y);
    doc.setFont('helvetica', 'normal');
    y += 15;

    // Section: Participantes
    doc.setFontSize(16);
    doc.setTextColor(0, 102, 204);
    doc.text('Rateio por Participante', 20, y);
    y += 8;
    doc.line(20, y, 190, y);
    y += 10;

    routeResult.passengerDetours.forEach((p, idx) => {
      if (y > 260) { doc.addPage(); y = 20; }
      
      doc.setFontSize(12);
      doc.setTextColor(20, 20, 20);
      doc.setFont('helvetica', 'bold');
      const role = p.isDriver ? (isDedicated ? 'Motorista (Dedicado)' : 'Motorista (Dono do Carro)') : `Passageiro ${idx + 1}`;
      doc.text(`${p.passengerName} - ${role}`, 25, y);
      y += 6;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      
      const pct = totalArrecadado > 0 ? (safeNumber(p.paymentAmount) / totalArrecadado) * 100 : 0;
      
      if (!p.isDriver) {
        const pass = routeResult.orderedPassengers.find(op => op.id === p.passengerId);
        const eta = routeResult.stopEtas?.find((_, i) => routeResult.orderedPassengers[i].id === p.passengerId);
        
        doc.text(`Parada: ${pass?.location.label}`, 30, y); y += 5;
        if (eta) {
          doc.text(`Horário estimado de desembarque: ${formatTime(eta)}`, 30, y); y += 5;
        }
        doc.text(`Desvio causado: ${safeNumber(p.detourKm).toFixed(1)} km`, 30, y); y += 5;
      } else {
        if (isDedicated) {
          doc.text('Motorista não participa da divisão do custo e cobra ida + volta.', 30, y); y += 5;
        } else {
          doc.text('Custeia apenas sua parte proporcional do combustível base.', 30, y); y += 5;
        }
      }
      
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text(`VALOR FINAL: ${formatCurrency(p.paymentAmount)} (${pct.toFixed(1)}% do total)`, 30, y);
      doc.setFont('helvetica', 'normal');
      y += 12;
    });

    const filename = `detalhe_viagem_${new Date().getTime()}.pdf`;
    
    if (Capacitor.isNativePlatform()) {
      await saveMobilePDF(doc, filename);
    } else {
      doc.save(filename);
    }
  },

  /**
   * Generates an individual passenger summary PDF
   */
  async generatePassengerPDF(data: TripPDFData, passenger: PassengerDetour, eta?: Date) {
    const { trip, routeResult } = data;
    const isDedicated = routeResult.executionMode === 'DEDICATED';
    const doc = new jsPDF();
    let y = 30;

    // Header
    doc.setFontSize(22);
    doc.setTextColor(20, 20, 20);
    doc.text('Comprovante de Carona', 105, y, { align: 'center' });
    y += 10;
    
    doc.setFontSize(14);
    doc.setTextColor(50, 50, 50);
    doc.text(trip.shortId ? `ID: ${trip.shortId}` : `Viagem: ${trip.tripName}`, 105, y, { align: 'center' });
    y += 8;

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 105, y, { align: 'center' });
    y += 20;

    // Section: Passageiro
    doc.setFontSize(18);
    doc.setTextColor(0, 102, 204);
    doc.setFont('helvetica', 'bold');
    doc.text(`Passageiro: ${passenger.passengerName}`, 20, y);
    doc.setFont('helvetica', 'normal');
    y += 10;
    doc.setDrawColor(0, 102, 204);
    doc.line(20, y, 190, y);
    y += 15;

    // Section: Detalhes do Trajeto
    doc.setFontSize(14);
    doc.setTextColor(40, 40, 40);
    doc.text('Resumo do Trajeto', 20, y);
    y += 8;
    
    doc.setFontSize(11);
    doc.setTextColor(80, 80, 80);
    doc.text(`Origem: ${trip.origin.label}`, 25, y); y += 6;
    
    // Find passenger position
    const passData = routeResult.orderedPassengers.find(p => p.id === passenger.passengerId);
    if (passData) {
      doc.setTextColor(0, 102, 204);
      doc.setFont('helvetica', 'bold');
      doc.text(`SUA PARADA: ${passData.location.label}`, 25, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      y += 6;
    }
    
    doc.text(`Destino Final do Carro: ${trip.destination.label}`, 25, y); y += 12;

    // Cronograma
    if (routeResult.timeEstimate) {
      doc.setTextColor(40, 40, 40);
      doc.text(`Início da Viagem: ${formatTime(routeResult.timeEstimate.departureTime)}`, 25, y); y += 6;
      if (eta) {
        doc.setTextColor(0, 102, 204);
        doc.setFont('helvetica', 'bold');
        doc.text(`SEU DESEMBARQUE ESTIMADO: ${formatTime(eta)}`, 25, y);
        doc.setFont('helvetica', 'normal');
        y += 6;
      }
    }
    y += 10;

    // Section: Memória de Cálculo
    doc.setFontSize(14);
    doc.setTextColor(0, 102, 204);
    doc.text('Memória de Cálculo', 20, y);
    y += 8;
    doc.line(20, y, 190, y);
    y += 10;

    doc.setFontSize(11);
    doc.setTextColor(80, 80, 80);
    
    // Calculate components using centralized engine
    const kmPerLiter = safeNumber((trip as any).kmPerLiter, 12);
    const fuelPrice = safeNumber((trip as any).fuelPrice, 5.80);
    
    const breakdown = CostEngine.calculateTripCosts({
      totalDistanceKm: safeNumber(routeResult.totalDistanceKm),
      returnDistanceKm: safeNumber(routeResult.returnDistanceKm),
      kmPerLiter,
      fuelPrice,
      executionMode: routeResult.executionMode
    });
    
    if (isDedicated) {
      const passengerCount = routeResult.passengerDetours.filter(p => !p.isDriver).length;
      const fuelPerPerson = passenger.pureFuelCost || 0;
      const margin = passenger.marginAmount || 0;

      doc.text(`Modalidade: Motorista Dedicado (Ida + Volta)`, 25, y); y += 6;
      doc.text(`1. Custo Total de Combustível (Ida: ${safeNumber(routeResult.totalDistanceKm).toFixed(1)}km + Volta: ${safeNumber(routeResult.returnDistanceKm).toFixed(1)}km): ${formatCurrency(breakdown.fuelCost)}`, 25, y); y += 6;
      doc.text(`2. Sua Cota do Combustível (dividido por ${passengerCount} passageiros): ${formatCurrency(fuelPerPerson)}`, 25, y); y += 6;
      const marginPct = fuelPerPerson > 0 ? Math.round((margin / fuelPerPerson) * 100) : 0;
      doc.text(`3. Margem/Serviço Motorista (${marginPct}%): ${formatCurrency(margin)}`, 25, y); y += 12;

    } else {
      const fuelTotal = passenger.pureFuelCost || 0;
      const margin = passenger.marginAmount || 0;

      doc.text(`1. Divisão Base do Combustível: ${formatCurrency(passenger.baseFuelCost)}`, 25, y); y += 6;
      doc.text(`2. Custo do seu Desvio: ${formatCurrency(passenger.detourFuelCost)}`, 25, y); y += 6;
      const marginPct = fuelTotal > 0 ? Math.round((margin / fuelTotal) * 100) : 0;
      doc.text(`3. Margem/Serviço Motorista (${marginPct}%): ${formatCurrency(margin)}`, 25, y); y += 12;
    }

    // Final Box
    doc.setDrawColor(0, 153, 76);
    doc.setFillColor(245, 255, 245);
    doc.roundedRect(20, y, 170, 25, 3, 3, 'FD');
    
    doc.setFontSize(16);
    doc.setTextColor(0, 102, 0);
    doc.setFont('helvetica', 'bold');
    doc.text(`VALOR TOTAL A PAGAR: ${formatCurrency(passenger.paymentAmount)}`, 105, y + 16, { align: 'center' });

    y += 45;
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'italic');
    doc.text('Este documento é um informativo de rateio gerado pelo RachaFácil.', 105, y, { align: 'center' });
    doc.text('Valores calculados com base na distância real e detours individuais.', 105, y + 4, { align: 'center' });

    const filename = `comprovante_${passenger.passengerName.toLowerCase().replace(/\s+/g, '_')}.pdf`;
    
    if (Capacitor.isNativePlatform()) {
      await saveMobilePDF(doc, filename);
    } else {
      doc.save(filename);
    }
  }
};
