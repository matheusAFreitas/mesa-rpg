# Backlog — Mesa do Mestre

Sessão de testes realizada em 2026-03-24. Itens reportados, organizados por categoria.

---

## Bugs

- [x] **Fundo preto** — fundos clareados mantendo paleta verde (#0A1209, #101F12, #172B18)
- [x] **Bug de combate sem target** — null-check no input DOM + ajuste de c.cur ao remover combatente ativo
- [x] **F5 desconecta jogador** — pj.id salvo em localStorage, restaurado automaticamente no init

---

## Combate

- [ ] **Dados normais vs dados de combate** — separar rolar dado comum de dado de combate
- [ ] **Dado de combate no turno** — se o jogador rolar dado de combate no seu turno, o dano é aplicado automaticamente no inimigo
- [ ] **Sistema de combate mais dinâmico** — melhorar fluxo geral de combate
- [ ] **Modal de efeitos de status** — stun, paralyze, etc aplicáveis aos personagens

---

## Jogadores & Visibilidade

- [ ] **Ver outros jogadores** — jogadores conseguem ver o status/info de outros jogadores
- [ ] **Sistema de espectador** — modo para assistir sem participar
- [ ] **Bug F5 / reconexão** — manter sessão do jogador ao recarregar

---

## Inventário & Equipamento

- [ ] **Separar inventário de equip e inventário de itens** — dois slots distintos
- [ ] **Sistema de baú** — itens aparecem em modal para o jogador pegar
- [ ] **Modal de item** — quando um item aparece para o jogador, exibir modal
- [ ] **Melhorar sistema de inventário** — UI e UX geral
- [ ] **Sistema de criação de item** — interface melhor para criar itens customizados
- [ ] **Fórmula de upgrade** — sistema para melhorar/evoluir itens
- [ ] **Sistema de farming de itens** — geração dinâmica de itens

---

## Personagem

- [ ] **Sistema de estresse** — barra ou medidor de estresse do personagem
- [ ] **Durabilidade de arma** — armas se desgastam com uso
- [ ] **Sistema mental** — sanidade ou estado psicológico do personagem
- [ ] **Sistema de revive** — mecânica de ressurreição
- [ ] **Melhorar sistema de classes** — formulário ou tela dedicada para configurar classes

---

## Mestragem & Universos

- [ ] **Modos de mestragem** — universos separados e universos mesclados
- [ ] **Arrumar sistema de conexões do universo** — bug/melhoria nas conexões entre locais/universos
- [ ] **Sistema mais caótico** — opção de adicionar eventos aleatórios / imprevisíveis à sessão

---

## Clima & Ambiente

- [ ] **Sistema de clima e tempo** — painel/deck de clima visível
- [ ] **Temas de ambiente** — temas visuais que mudam de acordo com o ambiente dos jogadores

---

## Comunicação

- [ ] **Captar mensagens dos jogadores** — forma de o mestre receber inputs/mensagens
- [ ] **Chat entre jogadores** — sistema de chat em tempo real
- [ ] **Modal de warning global** — mestre envia alerta com mensagem customizada para todos

---

## Conteúdo / Lore

- [ ] **SCP-682** — adicionar SCP-682 como criatura/entidade
- [ ] **PtE SCP-682** — item especial inspirado na carta "Path to Exile" do Magic: The Gathering; em vez de matar o SCP-682 (indestrutível), o item o exila permanentemente da sessão — solução narrativa para criaturas que não podem ser mortas normalmente
- [ ] **Reino da Morte** — adicionar como universo ou local especial

---

## Notas

> Itens marcados com `[ ]` ainda não iniciados. Mover para `[x]` conforme forem concluídos.
> Dúvidas sobre escopo de qualquer item: perguntar ao usuário antes de implementar.
