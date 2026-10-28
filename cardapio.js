/*
 * CARDÁPIO
 *
 * Cada categoria tem: id (sem espaços/acentos), nome, descricao (opcional)
 * e a lista de produtos.
 *
 * Cada produto tem:
 *   id          código único, sem espaços (ex.: "vixe-maria")
 *   codigo      opcional, aparece como selo (ex.: "01")
 *   nome        nome do produto
 *   descricao   ingredientes / detalhes
 *   preco       número, com ponto nos centavos (ex.: 23.9)
 *   foto        opcional, caminho da imagem (ex.: "vixe-maria.jpg")
 *               use imagens quadradas de ~600x600 em .jpg
 *   grupo       opcional, subtítulo dentro da categoria (ex.: "No pão árabe").
 *               Produtos com o mesmo grupo aparecem juntos.
 *   esgotado    opcional, true = aparece como indisponível
 */
window.CARDAPIO = [
  {
    id: "artesanais",
    nome: "Artesanais",
    descricao: "Smash burgers no pão brioche",
    produtos: [
      {
        id: "arriegua", codigo: "01", nome: "Arriegua", preco: 16.99,
        descricao: "Pão brioche, blend suculento, bacon, cheddar, alface, tomate e cebola roxa.",
        foto: "arriegua.jpg"
      },
      {
        id: "cabra-da-peste", codigo: "02", nome: "Cabra da Peste", preco: 19.5,
        descricao: "Pão brioche, blend, bacon, queijo coalho, cebola roxa, alface e tomate.",
        foto: "cabra-da-peste.jpg"
      },
      {
        id: "cangaceiro", codigo: "03", nome: "Cangaceiro", preco: 26.0,
        descricao: "Pão brioche, shimizu de frango, queijo coalho, molho derretido, bacon, ovo e cebola roxa.",
        foto: "cangaceiro.jpg"
      },
      {
        id: "vixe-maria", codigo: "04", nome: "Vixe Maria", preco: 28.0,
        descricao: "Pão brioche, blend smash, queijo coalho, interfolhado, carne de sol, bacon, ovo, batata palha, alface e tomate.",
        foto: "vixe-maria.jpg"
      },
      {
        id: "intenso-sertanejo", codigo: "05", nome: "Intenso Sertanejo", preco: 38.99,
        descricao: "Pão brioche, 2 blends de costela, queijo coalho, carne do sol desfiada, 6 fatias de bacon, cheddar fatiado, ovo, alface, tomate e cebola roxa.",
        foto: "intenso-sertanejo.jpg"
      },
      {
        id: "orradiaxu", codigo: "06", nome: "Ôrradiaxu'", preco: 21.0,
        descricao: "Pão brioche, smash queijo cheddar, bacon, ovo, frango, onion rings (anéis de cebola) e salada.",
        foto: "orradiaxu.jpg"
      }
    ]
  },
  {
    id: "tradicionais",
    nome: "Tradicionais",
    produtos: [
      {
        id: "arabe-bacon", grupo: "No pão árabe", nome: "Bacon", preco: 12.0,
        descricao: "Hambúrguer, bacon fatiado, ovo, queijo fatiado, alface e tomate.",
        foto: "arabe-bacon.jpg"
      },
      {
        id: "arabe-frango", grupo: "No pão árabe", nome: "Frango", preco: 14.0,
        descricao: "Hambúrguer, frango, ovo, queijo, presunto, alface e tomate.",
        foto: "arabe-frango.jpg"
      },
      {
        id: "arabe-lombo", grupo: "No pão árabe", nome: "Lombo", preco: 16.0,
        descricao: "Lombo trinchado, frango, bacon, ovo, queijo, presunto e salada.",
        foto: "arabe-lombo.jpg"
      }
    ]
  },
  {
    id: "bebidas",
    nome: "Bebidas",
    produtos: [
      { id: "suco-acerola", grupo: "Sucos naturais", nome: "Suco de acerola", preco: 7.0 },
      { id: "suco-abacaxi", grupo: "Sucos naturais", nome: "Suco de abacaxi", preco: 7.0 },
      { id: "suco-goiaba", grupo: "Sucos naturais", nome: "Suco de goiaba", preco: 7.0 },
      { id: "suco-manga", grupo: "Sucos naturais", nome: "Suco de manga", preco: 7.0 },
      { id: "suco-maracuja", grupo: "Sucos naturais", nome: "Suco de maracujá", preco: 9.0 },
      { id: "suco-caja", grupo: "Sucos naturais", nome: "Suco de cajá", preco: 10.0 },
      { id: "suco-graviola", grupo: "Sucos naturais", nome: "Suco de graviola", preco: 11.0 },

      { id: "vitamina-acerola", grupo: "Vitaminas · 500 ml", nome: "Vitamina de acerola", preco: 8.0 },
      { id: "vitamina-abacaxi", grupo: "Vitaminas · 500 ml", nome: "Vitamina de abacaxi", preco: 9.0 },
      { id: "vitamina-goiaba", grupo: "Vitaminas · 500 ml", nome: "Vitamina de goiaba", preco: 9.0 },
      { id: "vitamina-manga", grupo: "Vitaminas · 500 ml", nome: "Vitamina de manga", preco: 8.0 },
      { id: "vitamina-maracuja", grupo: "Vitaminas · 500 ml", nome: "Vitamina de maracujá", preco: 14.0 },
      { id: "vitamina-caja", grupo: "Vitaminas · 500 ml", nome: "Vitamina de cajá", preco: 10.0 },
      { id: "vitamina-graviola", grupo: "Vitaminas · 500 ml", nome: "Vitamina de graviola", preco: 13.0 },

      { id: "refri-guarana-lata", grupo: "Refrigerantes", nome: "Guaraná lata", preco: 6.0 },
      { id: "refri-coca-lata", grupo: "Refrigerantes", nome: "Coca-Cola lata", preco: 6.5 },
      { id: "refri-coca-600", grupo: "Refrigerantes", nome: "Coca-Cola 600 ml", preco: 9.0 },
      { id: "refri-guarana-1l", grupo: "Refrigerantes", nome: "Guaraná 1 L", preco: 9.5 },
      { id: "refri-cajuina-1l", grupo: "Refrigerantes", nome: "Cajuína 1 L", preco: 10.0 }
    ]
  }
];
