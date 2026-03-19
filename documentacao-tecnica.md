# Documentação Técnica do Sistema - TripSplit

## 1. VISÃO GERAL DO PROJETO

**Qual é o objetivo do aplicativo**
O TripSplit é uma aplicação web focada em calcular e dividir de forma justa os custos de uma viagem de carro entre o motorista e os passageiros. Através de algoritmos de roteamento e de divisão de custos, ele mensura com precisão o impacto no consumo de combustível gerado pelo desvio de rota que cada passageiro causa ao motorista.

**Qual problema ele resolve**
Normalmente, a divisão de custos de viagens ou caronas é feita de forma linear (dividindo o total em partes iguais) ou "no olho", o que pode ser injusto para passageiros que moram muito próximos do trajeto principal em comparação aos que causam um grande desvio. A aplicação resolve o viés de injustiça e de possíveis discussões, efetuando o cálculo matemático a partir da distância marginal gerada por cada parada, ou seja: o passageiro só paga pelo desvio que efetivamente causou. Além disso, garante que o motorista cubra a depreciação e o rateio igualitário do trajeto base através de uma taxa opcional.

**Fluxo geral de uso do usuário**
1. O usuário (normalmente o motorista) acessa a aplicação.
2. Na página inicial, clica em "Criar Viagem".
3. Preenche a Origem e Destino final da viagem principal.
4. Informa a eficiência do veículo (Km/L) e o preço do combustível (R$/L).
5. (Opcional) Define um cronograma se deseja sair ou chegar a um certo horário.
6. Adiciona seus passageiros informando nome e endereço exato.
7. Solicita o cálculo. A aplicação se encarrega de:
   - Otimizar a ordem das paradas de acordo com as localizações.
   - Computar a rota normal vs. rota com os desvios.
   - Ratear o custo financeiro.
8. Visualiza os resultados, que contêm mapa interativo, ETA de cada passageiro, custos discriminados e sugestões de rotas alternativas.
9. Exporta os detalhes em formato PDF global ou comprovante individual de rateio por passageiro.

**Tecnologias utilizadas**
- **Core:** JavaScript, React 19 (Hooks) e TypeScript.
- **Bundler e Tooling:** Vite, ESLint.
- **Roteamento Frontend:** React Router DOM V7.
- **Requisições de Rede:** Axios.
- **Serviço de Mapas e Rotas:** Mapbox (GL JS para exibição, Directions/Geocoding/Optimization APIs para cálculos e localizações).
- **Geração de PDF:** jsPDF e html2canvas.
- **Estilização:** CSS modular e global (Plain CSS).

---

## 2. ARQUITETURA DO SISTEMA

A arquitetura utilizada é **Modular baseada em Componentes e Serviços** (fortemente ligada a convenções do ecossistema React). O fluxo lógico está separado da UI.

**Estrutura de pastas**
```text
/src
 ├── assets/          - Arquivos estáticos e mídias visuais
 ├── components/      - Componentes visuais isolados, reutilizáveis e complexos
 ├── pages/           - Componentes em nível de página vinculados às rotas
 ├── services/        - Comunicação com APIS externas (Mapbox) e regras de geração de PDFs
 ├── types/           - Tipagens TypeScript globais (Interfaces do domínio do sistema)
 ├── utils/           - Regras de negócio puras (como o algoritmo principal de rateio financeiro)
 ├── App.tsx          - Configuração primordial do router dom e layout do header principal
 ├── main.tsx         - Entry point de inicialização de injeção na DOM (`root`)
 └── index.css / App.css - Reset CSS, Variáveis CSS e paletas de cores
```

**Responsabilidade de cada pasta**
- **`components/`:** Abstrai a interface do usuário em pequenos blocos de montar, mantendo a integridade do design system. Esses componentes não costumam carregar lógicas de negócios diretas profundas (com exceção do location). Eles funcionam através de props injetadas pelas páginas.
- **`pages/`:** Atuam como os orquestradores da navegação (Controller da UI). Elas gerenciam os Hooks de estado da sessão, formulários extensos, processam o envio de chamadas REST e orquestram a comunicação entre os `components` base.
- **`services/`:** Lidam majoritariamente de side-effects voltados a Input/Output externo, notavelmente chamadas assíncronas para a API do Mapbox e lógica iterativa para "desenho" da chapa do PDF.
- **`utils/`:** Possui funções puras sem contexto do React. A lógica principal de rateio financeiro se concentra aqui, a fim de deixá-la puramente funcional (`costCalculator`).
- **`types/`:** Importante como Contrato/Interfaces do sistema. Define estruturalmente todos os modelos de dados.

**Como os módulos se comunicam**
1. O usuário interage nas `Pages` alterando o estado local do React.
2. Durante preenchimentos, buscas locais engatilham métodos puramente de rede oriundos do `routeService`.
3. Ao solicitar o processamento, a `Page` colhe todo o pacote (viagem e seus paramêtros) e passa para `calculateRoute` dentro de `routeService`.
4. O `routeService` é o mestre de obra: bate na API do provedor geográfico, capta e normaliza a rota otimizada, roda os fluxos iterativos, calcula distâncias e em seguida passa apenas números e perfis pro `costCalculator.ts` na pasta `utils`.
5. Retorna-se o payload rico em dados formatados `RouteResult` para dentro da memória da SPA e o router o transfere como variável para a sub-rota (dashboard), fluindo em cascata por Props para os `components`.

---

## 3. MAPA COMPLETO DE COMPONENTES

### `LocationInput.tsx` (Componente UI com Lógica Interna)
- **Localização:** `src/components/LocationInput.tsx`
- **Responsabilidade:** Renderizar um input inteligente de buscas com "autocomplete" geográfico. Ele engatilha buscas locais na API Search/Geocoding do Mapbox (`searchLocation`), faz "debounce" dinâmico para evitar requests fúteis enquanto digita, extrai o Token das sessões e converte strings escolhidas em posições exatas Latitude/Longitude.
- **Componentes que ele utiliza:** `routeService.ts` puramente (sem outros componentes React).
- **Quem utiliza:** `CreateTripPage`, `PassengerForm`.

### `PassengerForm.tsx`
- **Localização:** `src/components/PassengerForm.tsx`
- **Responsabilidade:** Formulário iterador flexível para compor a lista dos ocupantes ("Adicionar", "Remover", gerenciar array indexado). Requer e monitora os nomes e para onde eles vão.
- **Componentes que ele utiliza:** Renderiza as caixas de `LocationInput` para cada respectivo passageiro.
- **Quem utiliza:** `CreateTripPage`.

### `RouteMap.tsx` / `MapView.tsx`
- **Localização:** `src/components/RouteMap.tsx` / `MapView.tsx`
- **Responsabilidade:** Montar e Renderizar o trajeto rodoviário em um Canvas complexo contendo um mapa interativo utilizando `mapbox-gl`. Ele sobrepõe vetores e pinta as linhas de direções geográficas vindos dos GeoJSONs e projeta ícones UI para as saídas, paradas enumeradas e bandeirada de chegada em tempo real. Lida ativamente com a montagem (`useEffect`) de renderização e desponta eventos de limpeza se for desativado.
- **Componentes que ele utiliza:** Apenas os plugins de UI nativos do pacote "mapbox-gl".
- **Quem utiliza:** `TripResultPage`.

### `StopList.tsx`
- **Localização:** `src/components/StopList.tsx`
- **Responsabilidade:** Componente de interface de marcação sequencial, que empilha e formata uma linha do tempo vertical descrevendo a cronologia estipulada do roteiro traçado. Transcreve o roteiro com cores conectivas e a hora prevista do ETA para cada desembarque.
- **Componentes que ele utiliza:** Nenhum dependente.
- **Quem utiliza:** `TripResultPage`.

### `CostBreakdown.tsx`
- **Localização:** `src/components/CostBreakdown.tsx`
- **Responsabilidade:** Componente tabular sumário. Consolida em linhas limpas a prestação de contas dos participantes, exibindo matematicamente os quilômetros desviados por cada ator, sua porcentagem base na culpa da rodagem paralela e quanto lhe custará. Também engatilha o export da fatura.
- **Componentes que ele utiliza:** Nenhum dependente.
- **Quem utiliza:** `TripResultPage`.

---

## 4. FLUXO DE DADOS

1. **Entrada de Dados:** Os dados entram de forma controlada localmente na `CreateTripPage`. Conforme o Typeahead devolve os Address, o formulário os injeta em variáveis baseadas em modelo (Origin, Destination e o Array iterativo de tipo Passenger).
2. **Computação e Limpeza (Processamento):**
   A submissão engatilha um dispatcher mestre (`calculateRoute`). Inicialmente a malha entra no `getOptimalRoute`. O Engine MapBox devolve o array comutativo com as ordens ótimadas (A famosa heurística do caixeiro-viajante).
3. **Mapeamento de Culpa (Isolamento Recursivo de Dados):**
   Com as distâncias principais retornadas, o software isoladamente itera o sub-array do carro tirando sistematicamente "um passageiro por vez" do mapa e rodando de novo as perguntas à nuvem sobre a distância. Assim a base tem a quilometragem global - quilometragem do roteiro sem fulano X. Este *delta* numérico é a carga do "Desvio marginal de responsabilidade restrita" processado para as varíaveis locais.
4. **Resumo Tributário e Carga Onde Ela Cabe:**
   As strings, paradas e números são passadas do service para a função utilitária pura (`costCalculator`). Ali aplica-se a cota linear básica pelo tamanho de espaço ocupado em comum no banco do veículo e as cotas não-lineares calculadas separadamente pelo Delta colhido do isolamento de culpa do passageiro 3 e do Motorista 1. Um Profit global ao esforço do carro entra em cena gerando variáveis calculadas finais de devolução.
5. **A Rota Até a Interface:**
   O pacote `RouteResult` complexo completo com linhas de mapa, alternativas temporais e valores de moeda é agrupado. O Controler da página transfere os vetores diretamente no Router `state` na URL (por debaixo dos panos reativamente) disparando o roteamento da Página Final `TripResultPage`, que atua como sink local renderizando as respostas para os Componentes listados.

---

## 5. ANÁLISE DE CADA ARQUIVO

- `package.json`/`vite.config.ts`: Define o contexto. Motor de script é Vite, Compilação estrita ESNext pelo TSCC, linter ESlint embarcado 100%. Múltiplas bibliotecas de manipulação gráfica de DOM (`html2canvas`).
- `src/main.tsx`: Entry point React, injeção inicial clássica React v19.
- `src/App.tsx`: Cria o `<BrowserRouter>`, constrói a Navbar universal flexível e registra as 3 subrotas fundamentais para os `<Routes>` do ecossistema.
- `src/types/index.ts`: O manual de instruções dos objetos da malha de dados. Interface das Geocoding, tipos Address, formatação cronológica da interface `TripSchedule`. Base da segurança local do typescript.
- `src/pages/HomePage.tsx`: Tela estática com Hero banner focado em SEO/Marketing e navegação de gatilho para a montagem de percursos.
- `src/pages/CreateTripPage.tsx`: Complexa. Componente recheado de Formulários Controlados. Agrupa lida com estados transitórios, manipulação de UI para relógio/hora preditiva (schedule modes "DepartAt" vs "ArriveBy"), checagem rigorosa de form Validation na flag dinânimica `isValid` e Loading screens.
- `src/pages/TripResultPage.tsx`: View final dos sumários. Consome `Location` state e processa UI paralela. Faz uso robusto de calculos paralelos interativos via `useMemo`. (Se no dashboard o motorista clica no balão na Rota Secundária Alternativa, ele reconta os deltas inteiros de porcentagem na UI sem precisar recarregar toda a requisição externa).
- `src/services/routeService.ts`: **O cérebro backend-like do projeto**. Possui diversas funções especializadas:
  - Cache manual em Ram (`searchCache`, `routeCache`).
  - Lógica extensiva para bater e traduzir APIs REST em `searchLocation`. Priorização de relevância semântica usando regex de rua, bairro, scores.
  - Sub-processo `getOptimalRoute`: Vai ao Mapbox Optimization V1.
  - Sub-processo múltiplo interativo `getRouteAlternatives`: Para contornar a limitação da nuvem da API, ele finge requisições alternadas sob variadas prespectivas do caixeiro viajante para garantir opções mais lentas e mais curtas.
  - Processo Cérebro `calculateRoute`: Faz toda a orquestra para gerar o plano integrativo entre desvios e roteamentos puros. 
- `src/services/pdfService.ts`: Desenhista vetorial virtual. Instancia a canvas JS, rebaixando `div` renderizada invisivel do gráfico pra imagem PNG, sobrepõe vetores estáticos de strings de recíbios com coordenadas X e Y puras do JSPDF na pagina A4 virtual. Transcreve o Buffer e delega para o Output nativo de download da engine do browser como arquivo `.pdf`.
- `src/utils/costCalculator.ts`: Executa pura matemática contábil não reativa. Recebe números frios sobre quem gastou o que de rodagem e entrega as carteiras vazias contábeis.

---

## 6. LÓGICA DE NEGÓCIO

A "cereja do bolo" deste software é sua matemática focada na **Justiça Proporcional Limitada**. Um aplicativo burro bateria tudo em uma calculadora linear. Se João viaja pra casa do lado da rodovia (gastou combustível, mas quase zero atraso real) e se Maria exige sair do asfalto ir por 20km pro interior na terra com ida e volta à estrada, a conta burra do posto penaliza João com a viagem pro interior da Mariazinha. Este software reescreve isso seguindo a matriz:

1. **Cálculo Base Rateável Linearmente:** Distância Origem -> Destino absoluto (Linha reta da estrada principal). Esse subtotal de custeio X se divide invariavelmente por todo ocupante por igualitariamente habitarem no carro do motorista.
2. **Custo Marginal pelo Impacto Exclusivo Desviado:** `Distância Real Otimizada COM A Parada Pessoal - Distância Sem A Parada Exclusiva Daquele Ocupante`. O combustível derivado só dessa sobra métrica marginal vai para a conta bancária faturada exclusivamente daquele único membro caroneiro causador e para de encarecer quem não tem nada a ver com o desvio. (Método do sub-array da exclusão rotativa).
3. **Custeamento do Esforço Próprio Motorista (Driver Margin Risk):** Uma carona é trabalho e desgaste de manutenções de pneus. O Motorista arca com o Custeio do trajeto direto dele na parcela Base. Todo passageiro então sofre na devolução final uma sobretaxa padrão hard-coded de `15%` em cima das custas geradas, categorizada na fita como Margem do Motorista gerando Profit limpo e segurança tarifária ao proprietário do app.

---

## 7. ESTRUTURA DA INTERFACE (UI)

O App adota uma arquitetura global Single Page App (SPA), separada em 3 grandes sub-seções mapeando roteamento virtual local.
1. **Página Resumo (Home):** Ponto de entrada descritivo. Animações e banners UI em Cards para apresentação conceitual.
2. **Página Workflow Formulário Controller (Criador de Viagem `CreateTripPage`):**
   - Inputs customizados auto-inteligentes com sub-caixas de Typeahead.
   - Cards temáticos separados para Inputs Numéricos de Frotamentos do Veículo e Checkbox Interativo Modal para os agendamentos.
   - Sessões renderizadas paralelamente por um Array Indexado interno React exibindo botões aditivos de preenchimento. Retrátil ou expansível ilimitadamente.
3. **Página Workflow Expositivo Analitico (Dash do Evento `TripResultPage`):**
   - Headings minimalistas exibindo trajetos textuais entre Cidades.
   - Banners Superiores e Cards colaterais comparativos das Rotas Variadas exibindo selos baseados na métrica temporal comparada ("cheapest", "fastest", "recommended"). Totalmente Clicáveis e reativos.
   - O Miolo denso é a instância pesada do GL JS que renderiza em formato full-width o mapa de satélite Dark nativo do framework embutido sem sair da página do usuário.
   - E por rodapé dois Containers separados pelo display-flex: Um componente de linha do tempo cronológico iterando descidas com timestamps das strings em base ISO Date transladada `StopList`, ao lado do Quadro Contabilista de Margens de lucros contendo barras visuais geradas de "fill css nativos `%`" `CostBreakdown`, com botões de acionagem do serviço transdutor do PDF atrelados aos Nodes HTML.

O sistema de estilização utiliza `CSS puro` não pré-processado, aderindo ao design system sombrio nativamente em todos seus fluxos visuais, mantendo o App fluido e rápido.

---

## 8. GERENCIAMENTO DE ESTADO

O Software usa nativamente padrões do modelo conceitual Flux minimizado dentro das entrelinhas nativas Hooked em React Vanilla de escopo regional. Ele optou por não criar Stores gigantes redutores com middlewares pesados. Explicando:
- **Estados de Interações do Ciclo do Usuário:** Moram confinados e ilhados dentro de states nativos localizados: `const [passengers, setPassengers] = useState<Passenger[]>([])` habitando os Forms da Page base. Ao digitar e deletar um caroneiro os ciclos re-renderizam a sub-árvore local com performance. Dados cruzados são repassados por meio do padrão *Two-Way Props Drill*. (Page desce Função modificadora pro Componente, Componente interage via prop-call onChange atualizando a Page Mestra).
- **Dados Residuais de APIs não dinâmicos (Cache Storage):** Ao invés de usar Context para evitar re-requests desnecessários, a regra global criou Maps nativos puros estáticos singleton-like `searchCache` e `routeCache` duráveis para todo ciclo de vida do Front end agindo com marcadores temporais TTL.
- **Transação Assíncrona inter-paginas Sem Context:** Em vez de usar URL Query Params gigantes que quebram semantismos ou injetar coisas e sujar Stores globais atoa (Zustand), o App adota a ponte de Router nativa: Passar obj complexo recheado no histórico binário do evento `navigate('/resultado', { state: { trip, routeResult } });`. A página consumidora final apenas retira, destrinça o objeto e entrega estaticamente a base da UI pro React cuidar. Limpo, e se o usuário der refreshes totais em sub-páginas, o estado null trata e joga pra fora devolta pro criador sem quebrar nado do código.

---

## 9. DEPENDÊNCIAS DO PROJETO 

Identificadas a fundo em seus módulos:
- **A Arquitetura UI Mestra:** `react`, `react-dom` (Engine UI Core), `react-router-dom` (Rotas e History APIs).
- **O Comunicador Protocolar:** `axios` - Cliente HTTP utilitário baseado em promises robustas.
- **O Componente UI Híbrido Gráfico:** `mapbox-gl` e `@types/mapbox-gl` - Para manipulação do Widget nativo Canvas 3d WebGL e APIs espaciais do fornecedor global Mapbox em sua última variante estável. 
- **Os Geradores de Células de Arquivos:** `jspdf` - Compilador de relatórios visuais transdutor PDF baseado em grid string layout.
- **O Transitor visual Bitmap:** `html2canvas` - Extrator Snapshot visual nativo em sub-trees do DOM para plotar a visualização externa mapbox e injetá-la chumbada pra sempre no report PDf final para auditoria do evento da corrida off-line. 

---

## 10. FLUXO COMPLETO DO SISTEMA

Eis o passo a passo absoluto da engrenagem do inicio ao fim processual de um evento de App na visão sub-layer:
1. **T0 (Warm-up System):** App iniciado via Node bundler/build do projeto. Inicializou as classes nativas no `root` index.html, desempilhou todas as csss encadeadas. Componente Router DOM assumiu tela inteira inicial `/`.
2. **T1 (Ações de Entrada no Painel de Controle):** O Usuário solicita Criação do Evento. State limpo iniciado. Começa o processo Input Text ("Camp"), 300ms passaram sem digitção: Disparo ao back end do MapBox, Retornou Listagem ("Campinas, SP Area Metropolitana"). Usuário Mousedowns. Dispara request secundário mapbox para conversão da Search result em Latitude e longitude real Float `x,x,;y,y,`. Set do Origin Location Object real no hook global. Usuário insere ocupantes em Loop que re-aciona a estrutura de buscas SearchBox pra todos sucessivamente.
3. **T2 (Aceleramento Interativo):** Evento Submit Disparado. Muta State App para Loading Lock (impedir duplos sends). Dispatch request chamando o cérebro agnostico: `calculateRoute(tudo)`. Ele liga a request REST a url Optimization Maps e passa Origem, Destino e 3 coords centrais. Cloud AWS do servidor gringo reage retornando JSON contendo "A ordem melhor e menor do cixeiro é 2->0->1->3", a malha é salva.
4. **T3 (Processamento Pesado Paralelo Isolativo - O "Loop Marginal"):** O software abre laco `For-Of`. Pega a lista original e clona. Isola Passageiro A, Pergunta a Cloud "E o cixeiro como fica assim?", Pega kms. Isola Passageiro B, Vai pra Cloud, salva kilometros isolados per si. O processador termina tudo, faz Subtração final gerando os impactantes valores e lança pelo cano do utilitário pro Rateador matemático `splitCost`. Resultando é guardado na nuvem JS local ram. Transação assíncrona despachadora `getRouteAlternatives` procura comutas e mescla perfis em cima de meta-rotas do percurso real e envia junto ao pacotão.
5. **T4 (Transição SPA e Reações View):** O state React Router injeta os dados na tela estática nova, apaga o loading anterior, a tela desenha as variáveis cruas por sobretelas. O Efeito interativo do MapboxGL entra vivo captanto e estilizndo ícones dinanmcos (marcadores) pintando a linha em cores vibrantes baseada no array embutido. Telas numéricas calculadas. Finalização Interativa com Geração Local Offline do documento A4 via Action click formatando matrizes e devolvendo o recibo oficial base e recibos individuais paralelos por intermédio das malhas `jspdf` finalizadas. Evento Concluido com Exito arquitetural completo sem banco de dados externo gravando logs sujos indesejados mantendo privacidade.

---

## 11. PONTOS IMPORTANTES DO CÓDIGO

### **Trechos e Modelos Críticos de Atenção:**
- **Sistema Combinado de Classificações Algoritmicas (`searchLocation`)**: No modulo `routeService.ts`, não basta um request e repasse da lista ao UI. O código injeta *Hand-made Ranking heuristics*, pontuando a prioridade local dependendo se o tipo dela vem tipado da api como 'city', 'poi', 'region' mesclado ao Text Match puro para limpar lixos indesejados nas propostas aos motoristas.
- **Alternativas "Hackeadas" na Nuvem (`getRouteAlternatives`)**: A limitação crassa de projeto na cloud gringa exige 2 paradas máximas no directions param alternative option (Isso por custo de maquinas deles). O código sobrepuja a limitaçlão artificialmente despachando sub-requests pra diferentes Perfis de transitos puramente base e agrupando os resultantes combinatórios dedupados manualmente num cache Set pra ter diversificação nas UI (Fast, Chepeast, Recommended options). Muito Engenhoso.

### **Grau de Complexidade Avançada ou Riscos:**
- O Maior risco que o projeto corre é na saturação (Throattling Limits) do Plano nativo da API Rest mapbox. Como a Engine de lógicas depende intimamente (E iterativamente e reclusamente a cada passageiro) das distâncias complexadas originais calculadas fora de casa, a adição maciça de muitos postos de pessoas fariam o laço de repetições sequenciais explodirem o SLA do MapBox bloqueando por 429 requests de overload ou demorando mais de 12 segundos pro cliente receber as rotas no view. Escalar o App globalmente exigiria uma transposição dessa Engine pra Nuvem própria interna do desenvolvedor usando serviços baseados em OSSHM e OpenStreet Maps locais por conteiners docker pra não quebrar financeiramente as contas da API.

---

## 12. DIAGRAMA LÓGICO DO SISTEMA


```text
  [Interface Controladora Input / Frontend Base: CreateTripPage]
          |
         [2x Inputs Originais] + [Variáveis de Input p/ Nx Coords "Passageiros Dinamicos"]  
          ↓
  (SERVIÇO/GATEWAY OMINIDIRECIONAL: routeService.ts) <- (Buscas Autocompletes LocationInput => Proxy => REST API Mapbox Search) 
          |
  [ Fase A: Routing Optimization ] - (Proxy Otimização AWS Mapbox: Qual a ordem natural matemática para encadear os N pontos listados?)
          |
  [ Fase B: O Processamento em Malhas de Cálculo Marginal ]   
  (Rodar rotinas em ForLoop sobre o `getOptimalRoute` suprimindo providencialmente e virtualmente 1 passageiro diferente de cada respectiva vez)
          |
  [ Fase C: O Espelho Linear O-D Direto ]
  (Rodar Rota Base do Esforço: Custeio e kilometragem fria e direta Sem as interferências e os desvios de Nenhum Passageiro na rota)
          |
          ↓
  (UTILITÁRIO/ENGINE DE NEGÓCIOS REGIONAL: costCalculator.ts) 
     - Executa de maneira crua os Deltas de percurso.
     - Isola cota linear pra galera dividida e Atrela as multas de cota Desviada pros geradores de interferências do trajeto original limpo.
     - Injeta imposto "Driver Margin Profit de 15%" sobre o calculo total apurado nas faturas emitidas.
          |
          ↓
  [Interface de visualização de Relacionamentos Analíticos / Dashboard: TripResultPage]
    ├── Hook -> [Renderiza(RouteMap Component Baseado em Instâncias Canvas por WebGL Native da Blibioteca MapboxGLJS)] 
    ├── Hook -> [Renderiza(Sub-Tabelas de Fórmulas analíticas repassadas via Parâmetros de Componentes React)]
    └── [Eventos Assíncronos/Botões (Download) despacham dados brutos textuais -> Serviço Abstrativo de Chapa Vetorial: pdfService.ts] => (Compila Json p/ A4 Virtual usando PDF_Gen base Engine => Devolve Download Stream pro OS.)
```

---

## 13. RESUMO FINAL

Em suma, **o sistema funciona** em sua plenitude como um agente frontend arquitetônico delegador altamente modular e estritamente amarrado a conceitos Reativos (Single Page Application moderna) - não se escorando em backend relacionais pesados nem bancos de dados duradouros de longo prazo. O trunfo arquitetônico confia reter toda a digitação e intenções nos fluxos de controle das telas dos usuários e submeter suas incertezas geográficas por completo aos servidores mundiais da API Mapbox, absorvendo e normalizando dados complexados destilados (geocódigos e métricas temporais assíncronas calculadas remotamente). Apenas e com exclusividade em seu próprio kernel e utils locais o front-end executa matemáticas lógitias precisas ponderando as intersecções de tempo de cada usuário da corrida isoladamente pelo algoritmo original de "Métricas Fatoradas por Desvios Marginais", para findar entregando uma modelagem robusta, limpa, infalível via UI em painéis com faturas contábeis interativas que agem sob medida prontas e finalizadas para o rateio humano ser exportado com segurança em formato legalizado digital sem salvar históricos locais invasivos ou que quebrem as SLAs nativas de escalabilidade.
