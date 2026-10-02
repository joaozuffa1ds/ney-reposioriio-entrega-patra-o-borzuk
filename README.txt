TORNEIO DE ALUNOS - ARCADE

Controles:
W A S D = mover
1 2 3 = escolher item no LEVEL UP
P = pausar

Regras atuais:
- O jogador começa com a PISTOLA.
- A pistola dispara automaticamente a cada 0,70 segundo.
- Máximo de 5 armas equipadas.
- Escolher uma arma que já possui aumenta seu nível até LV5 e aumenta o dano.
- Cada arma possui um ataque/comportamento próprio.
- Sword of Valor não aparece nas opções de aquisição.
- Armas comuns usam cooldown de 0,70 s; armas de dano muito alto têm cooldown maior para balanceamento.
- As armas atacam automaticamente, sem botão de tiro ou troca manual.


ATUALIZAÇÃO
- A velocidade de spawn dos inimigos aumenta 30% por onda, com limite mínimo de intervalo para manter o jogo estável.
- Inimigos comuns têm 5% de chance de deixar um baú.
- O baú usa a imagem fornecida pelo jogador e oferece 3 relíquias.
- Chefes continuam deixando um baú garantido.

CORRECOES DE DESEMPENHO - TESTE LONGO
- Spawn de inimigos continua aumentando 30% por onda, mas existe um limite de inimigos ativos para impedir crescimento infinito de entidades.
- Apenas um boss pode permanecer ativo por vez.
- Colisao/separacao inimigo-contra-inimigo deixou de usar comparacao O(n²), principal causa de travamento em ondas altas.
- Existe limite seguro para projeteis, tiros inimigos, particulas e orbes.
- Audio usa uma voz WebAudio reutilizada em vez de criar um OscillatorNode/GainNode por efeito sonoro.
- HUD e atualizado em frequencia reduzida para diminuir trabalho do navegador.
- Niveis das armas continuam infinitos, mas os calculos de dano usam limites numericos internos para evitar Infinity/NaN em niveis absurdamente altos.
