/**
 * Degradê de leitura no topo da tela (`--scrim-top` do handoff, tokens/elevation.css).
 *
 * O handoff define o token e diz onde usá-lo — "protection gradient behind
 * floating UI over the map" — mas ele nunca chegou ao `index.css` nem foi
 * renderizado; o cabeçalho de localização e o botão de menu ficaram apoiados
 * só no próprio fundo. Sobre um mapa claro com rua branca, texto escuro sem
 * nada atrás fica no limite da leitura.
 *
 * POR QUE UM DEGRADÊ E NÃO UMA BARRA. Uma barra sólida corta o mapa numa linha
 * reta e o topo deixa de ser mapa. O degradê protege o texto onde ele está e
 * devolve o mapa alguns pixels abaixo, sem borda visível.
 *
 * A COR NÃO É A MESMA NOS DOIS TEMAS. Branco sobre o mapa noturno clarearia o
 * topo e destruiria o contraste que os textos claros dependem — no escuro o
 * degradê é a própria cor de fundo do app. O princípio é o mesmo (aproximar o
 * fundo da cor do texto no topo), a cor é o oposto.
 *
 * NÃO INTERCEPTA TOQUE: `pointer-events-none`. O mapa continua arrastável sob
 * ele, e os controles ficam por cima porque este elemento é irmão anterior
 * deles no DOM.
 */
export function TopScrim() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[var(--scrim-top-height)] bg-[image:var(--scrim-top)]"
    />
  )
}
