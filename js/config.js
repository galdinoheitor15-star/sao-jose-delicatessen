/* =========================================================
   Configuração da loja — Delicatessen São José (Carpina – PE)
   Tudo que é "da loja" fica aqui: contato, horário, delivery,
   avaliações e a ligação com o Firebase.
   ========================================================= */

export const STORE = {
  name: 'Delicatessen São José',
  tagline: 'Mais do que uma padaria!',
  whatsapp: '5581996259055',           // só números, com DDI 55
  phoneLabel: '(81) 99625-9055',
  instagram: 'delicatessensaojose',
  address: 'Av. Gov. Agamenon Magalhães, 285 — São José, Carpina – PE, 55815-072',
  addressShort: 'Av. Agamenon Magalhães, 285 · Carpina',
  coords: { lat: -7.8430736, lng: -35.2559101 },
  mapsUrl: 'https://www.google.com/maps/place/Delicatessen+S%C3%A3o+Jos%C3%A9/@-7.8430736,-35.2559101,17z',
  hours: { open: 6, close: 22 },       // todos os dias, das 6h às 22h
  // Chave Pix da loja para gerar o QR Code no fechamento da conta.
  // Deixe vazio até o dono informar a chave (aí o QR some e fica só "Pix").
  pix: { key: '', name: 'DELICATESSEN SAO JOSE', city: 'CARPINA' }
};

/* Avaliações reais do Google (perfil "Delicatessen São José", Carpina).
   Textos copiados sem alteração. */
export const RATING = { value: 4.4, count: 2119, source: 'Google' };
export const REVIEWS = [
  {
    name: 'Adriana Wanderley',
    meta: 'Avaliação no Google',
    stars: 5,
    when: 'há 6 meses',
    text: 'Sempre compro pães, doces e salgados nesse lugar, logo cedinho já encontro todas as variedades do que procuro. O almoço é excelente e variadissimo nas opções. Vale a pena pois o preço é justo.'
  },
  {
    name: 'Wallacy',
    meta: 'Avaliação no Google',
    stars: 5,
    when: 'há 1 ano',
    text: 'É uma ambiente bem organizado, com atendimento bom. Comidas saborosas, valores um pouco alto, mas com serviço de excelência. Comi um crossaint e estava bom demais.'
  },
  {
    name: 'Cauby Neto',
    meta: 'Local Guide · 608 avaliações',
    stars: 5,
    when: 'há 3 anos',
    text: 'Uma boa padaria, com grande foco em refeições self-service e também cardápio a la carte. Possui um um ambiente agradável num grande salão em "L", com mesa de servir longa e bem variada. A localização é na via principal da cidade e possuí um estacionamento frontal reduzido. A recomendação é chegar cedo nos horários das refeições e pegar tudo bem fresco no self-service'
  }
];
export const REVIEWS_URL = 'https://www.google.com/maps/place/Delicatessen+S%C3%A3o+Jos%C3%A9/@-7.8430736,-35.2559101,17z/data=!4m8!3m7!1s0x7aba04c57ec4731:0xe2fed8ffd1ee3140!8m2!3d-7.8430736!4d-35.2559101!9m1!1b1';

/* Delivery: bairros atendidos e taxas.
   VALORES DE EXEMPLO — o gerente ajusta no painel (/admin). */
export const DELIVERY = {
  radiusKm: 6,             // raio máximo a partir da loja (checagem por localização)
  minOrder: 20,
  eta: '35–55 min',
  zones: [
    { id: 'sao-jose', name: 'São José', fee: 4 },
    { id: 'centro', name: 'Centro', fee: 5 },
    { id: 'sao-sebastiao', name: 'São Sebastião', fee: 5 },
    { id: 'santo-antonio', name: 'Santo Antônio', fee: 5 },
    { id: 'santa-cruz', name: 'Santa Cruz', fee: 6 },
    { id: 'santa-terezinha', name: 'Santa Terezinha', fee: 6 },
    { id: 'bairro-novo', name: 'Bairro Novo', fee: 6 },
    { id: 'caja', name: 'Cajá', fee: 7 },
    { id: 'senzala', name: 'Senzala', fee: 7 },
    { id: 'madre-rosa', name: 'Madre Rosa', fee: 7 },
    { id: 'caramuru', name: 'Caramuru', fee: 8 },
    { id: 'carauba-torta', name: 'Caraúba Torta', fee: 8 }
  ]
};

export const PAYMENTS = [
  { id: 'pix', name: 'Pix' },
  { id: 'dinheiro', name: 'Dinheiro' },
  { id: 'credito', name: 'Cartão de crédito' },
  { id: 'debito', name: 'Cartão de débito' },
  { id: 'vr', name: 'Vale-refeição' },
  { id: 'va', name: 'Vale-alimentação' }
];

/* Firebase (pedidos e comandas em tempo real entre aparelhos).
   Enquanto ficar null, o sistema roda no "modo demonstração":
   tudo salvo no navegador, sincronizando entre abas do mesmo aparelho.
   Passo a passo em FIREBASE.md. */
export const FIREBASE_CONFIG = null;

/* Quem é gerente (pode mexer em produtos e preços) no modo Firebase.
   As regras do Firestore (firestore.rules) são quem realmente protege. */
export const MANAGER_EMAILS = ['EMAIL_DO_GERENTE@gmail.com'];

/* Modo demonstração: PINs de teste para entrar nos painéis.
   Só valem neste navegador; em produção o login é pelo Firebase. */
export const DEMO_PINS = { equipe: '1111', gerente: '2468' };
