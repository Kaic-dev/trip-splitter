import React from 'react';
import type { PassengerPayment } from '../../types';
import { PassengerImpactCard } from './PassengerImpactCard';

interface Props {
  tripPayments: PassengerPayment[];
  loading: boolean;
  pdfLoading: boolean;
  onFullPdf: () => void;
  onPassengerPdf: (payment: PassengerPayment) => void;
  onTogglePayment: (id: string) => void;
}

export const PaymentDetailList: React.FC<Props> = ({ 
  tripPayments, 
  loading, 
  pdfLoading, 
  onFullPdf, 
  onPassengerPdf, 
  onTogglePayment 
}) => {
  return (
    <section className="detail-card" id="payments-section">
      <div className="detail-card__header">
        <h2>💳 Pagamentos dos Passageiros</h2>
        <button className="btn btn--secondary btn--sm" onClick={onFullPdf} disabled={pdfLoading}>
          {pdfLoading ? '⏳' : '📄'} PDF da Viagem
        </button>
      </div>

      {loading ? (
        <p className="empty-note">Carregando pagamentos...</p>
      ) : tripPayments.length === 0 ? (
        <p className="empty-note">Nenhum passageiro registrado.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {tripPayments.map((payment: any) => (
            <PassengerImpactCard 
              key={payment.id}
              impact={payment}
              isPaid={payment.paid}
              pdfGenerated={!!payment.pdfGeneratedAt}
              onToggle={() => onTogglePayment(payment.id)}
              onPdf={() => onPassengerPdf(payment)}
            />
          ))}
        </div>
      )}
    </section>
  );
};
