/*
 * Informações da loja.
 * Edite aqui: nome, contato, horários, taxa de entrega e pagamentos.
 */
window.LOJA = {
  nome: "Sertão Burguer",
  cidade: "Fortaleza",
  slogan: "O sabor que conquista, a qualidade que fica!",

  // Somente números, com 55 (Brasil) + DDD + número.
  whatsapp: "5585982269650",
  telefoneExibicao: "(85) 98226-9650",

  endereco: "Rua Tomás Gonzaga, 386",
  bairro: "",          // ex.: "Conjunto Ceará"
  referencia: "",      // ex.: "Em frente à praça"

  raioEntregaKm: 5,
  taxaEntrega: 3.0,
  levaMaquinaCartao: false, // true = mostra "Levamos máquina de cartão até você"
  pagamentos: ["Pix", "Cartão", "Dinheiro"],

  // Fuso horário da loja (Fortaleza = UTC-3, igual a Brasília).
  fusoHorario: "America/Fortaleza",

  // Dias: 0 = domingo, 1 = segunda ... 6 = sábado.
  // Horário no formato "HH:MM". Dias fora da lista = fechado.
  horarios: {
    5: { abre: "19:00", fecha: "23:00" },
    6: { abre: "19:00", fecha: "23:00" },
    0: { abre: "19:00", fecha: "23:00" }
  },

  // Deixe false em produção. Use true só para testar o envio
  // do pedido pelo WhatsApp fora do horário de funcionamento.
  aceitarPedidosForaDoHorario: false
};
