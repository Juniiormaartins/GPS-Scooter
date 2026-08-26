# Teste de cores — identificar a camada da faixa branca

TEMPORÁRIO. Reverter com `git revert` do commit que o introduziu.

Cada camada que pode aparecer atrás do mapa recebeu uma cor berrante, para que
um único print identifique qual delas produz a faixa no rodapé. Três tentativas
de corrigir às cegas falharam; isto troca palpite por observação.

| cor visível na faixa | camada | o que significa |
|---|---|---|
| **verde** `#00ff00` | raiz do app (`<div>` em App.tsx) | o canvas do mapa é mais curto que o contêiner |
| **ciano** `#00ffff` | `body` | o `body` é mais alto que `#root`/raiz do app |
| **magenta** `#ff00ff` | `html` | a área existe fora do `body` fixo |
| **branco/cinza** | nenhuma | está fora da página — chrome do navegador ou do sistema |

Arquivos tocados: `src/index.css` (html, body), `src/App.tsx` (raiz).
