# Ligar o sistema em vários aparelhos (Firebase)

Sem o Firebase o site funciona no **modo demonstração**: tudo fica salvo só no navegador
(serve para mostrar ao cliente e testar). Para o celular do garçom, a TV da cozinha e o caixa
conversarem entre si, ligue o Firebase. Leva uns 10 minutos e é gratuito (plano Spark).

## 1. Criar o projeto
1. Acesse https://console.firebase.google.com e clique em **Criar projeto** (`sao-jose-delicatessen`).
2. O Google Analytics pode ficar desligado.

## 2. Banco de dados (Firestore)
1. **Criação → Firestore Database → Criar banco de dados**, local **southamerica-east1 (São Paulo)**, modo de produção.
2. Aba **Regras**: apague tudo, cole o conteúdo de `firestore.rules` e troque:
   - `EMAIL_DO_GERENTE@gmail.com` → e-mail do dono/gerente (pode ser uma lista: `['dono@gmail.com', 'gerente@gmail.com']`);
   - `EMAIL_DA_EQUIPE@gmail.com` → e-mail(s) usados pela equipe (caixa, cozinha, garçons).
3. **Publicar**.
4. Na aba **Índices**, nada a fazer: as consultas usam só um campo.

## 3. Login
1. **Authentication → Vamos começar → E-mail/senha** (ativar).
2. Aba **Usuários → Adicionar usuário**: cadastre os mesmos e-mails das regras, com senhas fortes.

## 4. Colar a configuração no site
1. Engrenagem ⚙ → **Configurações do projeto → Seus apps → `</>` (Web)**, apelido `site`, **Registrar app**.
2. Copie o objeto `firebaseConfig` e cole em `js/config.js`, no lugar do `null`:

```js
export const FIREBASE_CONFIG = {
  apiKey: '…',
  authDomain: 'sao-jose-delicatessen.firebaseapp.com',
  projectId: 'sao-jose-delicatessen',
  storageBucket: '…',
  messagingSenderId: '…',
  appId: '…'
};
```

3. No mesmo arquivo, coloque o e-mail do gerente em `MANAGER_EMAILS` (só controla o que aparece na tela;
   quem protege de verdade são as regras do passo 2).
4. Se tiver a chave Pix da loja, preencha `STORE.pix.key` para o QR Code aparecer no fechamento da conta.

## 5. Autorizar o domínio
**Authentication → Configurações → Domínios autorizados → Adicionar domínio** com o endereço onde o site
for publicado (ex.: `usuario.github.io`).

## 6. Primeiro uso
1. Abra `/admin/`, entre com o e-mail do gerente e altere qualquer preço: o cardápio inteiro é copiado
   para o banco nesse momento e passa a ser editável dali em diante.
2. Abra `/equipe/` na TV da cozinha (botão de tela cheia) e no celular dos garçons.
3. Imprima um QR Code por mesa apontando para `https://SEU-SITE/?mesa=1`, `?mesa=2`…
   O cliente pede pelo celular e o pedido cai direto na comanda da mesa.
