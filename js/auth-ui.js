/* Tela de entrada dos painéis.
   Modo demonstração: PIN. Modo Firebase: e-mail e senha da equipe. */
import { $, esc } from './util.js';

export function gate(be, { root, title, needRole, onUser }) {
  const needsManager = needRole === 'gerente';
  be.onAuth((user) => {
    const allowed = user && (!needsManager || user.role === 'gerente');
    if (allowed) { onUser(user); return; }
    onUser(null);
    root.innerHTML = `
      <main class="login">
        <form class="login__card" id="loginForm" autocomplete="on">
          <span class="brand"><b>São José</b><small>Delicatessen</small></span>
          <h1>${esc(title)}</h1>
          ${user && needsManager ? '<p class="login__err">Este acesso é só do dono ou gerente.</p>' : ''}
          ${be.mode === 'local' ? `
            ${needsManager ? '' : `<label class="field"><span>Perfil</span><select id="lgRole"><option value="equipe">Equipe (atendimento e cozinha)</option><option value="gerente">Gerente</option></select></label>`}
            <label class="field"><span>PIN</span><input id="lgPin" type="password" inputmode="numeric" autocomplete="current-password" required></label>
            <p class="demo-note">Modo demonstração: os dados ficam salvos só neste navegador. Os PINs de teste estão em <code>js/config.js</code> e o passo a passo para ligar em vários aparelhos, em <code>FIREBASE.md</code>.</p>
          ` : `
            <label class="field"><span>E-mail</span><input id="lgEmail" type="email" autocomplete="username" required></label>
            <label class="field"><span>Senha</span><input id="lgPw" type="password" autocomplete="current-password" required></label>
          `}
          <p class="login__err" id="lgErr" aria-live="polite"></p>
          <button class="btn btn--lg btn--block">Entrar</button>
          <a class="muted" style="font-size:13px;text-align:center" href="../">← Voltar ao site</a>
        </form>
      </main>`;
    $('#loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('#lgErr'); err.textContent = '';
      try {
        if (be.mode === 'local') await be.signIn(needsManager ? 'gerente' : $('#lgRole').value, $('#lgPin').value.trim());
        else await be.signIn($('#lgEmail').value.trim(), $('#lgPw').value);
      } catch (ex) {
        err.textContent = be.mode === 'local' ? ex.message : 'E-mail ou senha incorretos.';
        $('#loginForm').animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }], { duration: 300 });
      }
    });
  });
}
