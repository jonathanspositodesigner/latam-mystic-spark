## Plano: Novo Card Upscaler Créditos no Dashboard

### 1. Atualizar `stripe-webhook` para processar os 3 novos produtos
- Adicionar mapeamento dos product IDs: Starter (`prod_UHs9C4eDymNUY6` → 1500 créditos), Pro (`prod_UHs9JyYOd9A2b2` → 4200 créditos), Ultimate (`prod_UHs9ywC7aP3EVI` → 14000 créditos)
- Quando detectar compra de um desses 3 produtos: criar/encontrar usuário (mesmo fluxo atual), inserir créditos via `upscaler_credit_transactions`, registrar em `user_pack_purchases` com slug tipo `upscaler-creditos-starter`, `upscaler-creditos-pro`, `upscaler-creditos-ultimate`
- Enviar email de boas-vindas adaptado (mencionando créditos em vez de vitalício)

### 2. Criar componente `UpscalerCreditosCard`
- Card visual similar ao `UpscalerArcanoCard` mas com identidade visual diferente (cores de créditos/IA)
- Badge "IA por Créditos" em vez de "Vitalicio"
- Descrição: "Mejora tus fotos con IA usando créditos"
- Botão "Acceder" → navega para `/upscaler-arcano-tool`
- Botão "Adquirir" → link de compra (página `/creditos-upscaler` que já existe)

### 3. Atualizar lógica do `Dashboard.tsx`
- Detectar se usuário tem acesso vitalício (slugs existentes: `upscaller-arcano-v3`, `upscaller-arcano`, `upscaller-arcano-vitalicio`)
- Detectar se usuário comprou pack de créditos (slugs novos: `upscaler-creditos-starter`, `upscaler-creditos-pro`, `upscaler-creditos-ultimate`)
- Aplicar a lógica:
  - **Tem vitalício** → "Tus Compras": só card vitalício. Sem card de créditos.
  - **Tem créditos (sem vitalício)** → "Tus Compras": card créditos. "Otros Productos": card vitalício com botão comprar.
  - **Nada** → "Nuestros Productos": ambos cards com botão comprar.

### 4. Deploy do webhook atualizado
