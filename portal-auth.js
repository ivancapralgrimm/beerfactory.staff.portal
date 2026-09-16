const REGISTER_FUNCTION=SUPABASE_URL+'/functions/v1/staff-register';
const PROFILE_FUNCTION=SUPABASE_URL+'/functions/v1/staff-profile';

const _baseShell=shell;

shell=function(content,active='/'){
  _baseShell(content,active);

  const top=document.querySelector('.topin');
  const logout=document.getElementById('logoutBtn');

  if(top&&logout&&!document.getElementById('profileBtn')){
    const a=document.createElement('a');
    a.id='profileBtn';
    a.className='btn';
    a.href='#/profile';
    a.textContent='Профиль';
    top.insertBefore(a,logout);
  }
};

login=function(){
  document.getElementById('app').innerHTML=`
  <div class="loginWrap">
    <section class="loginCard">

      <div class="brand loginBrand">
        <span class="mark">BF</span>
        <span>
          <b>BEERFACTORY</b>
          <small>STAFF PORTAL</small>
        </span>
      </div>

      <div class="eyebrow">ВХОД ДЛЯ КОМАНДЫ</div>
      <h1>Войти в портал</h1>

      <p>Имя, фамилия и пароль. Без почты и телефона.</p>

      <form id="loginForm">

        <input
          class="search"
          id="firstName"
          autocomplete="given-name"
          placeholder="Имя"
          required
          maxlength="80">

        <input
          class="search"
          id="lastName"
          autocomplete="family-name"
          placeholder="Фамилия"
          required
          maxlength="80">

        <input
          class="search"
          id="code"
          inputmode="numeric"
          autocomplete="current-password"
          type="password"
          placeholder="Пароль · 4–12 цифр"
          required
          maxlength="12">

        <button
          class="btn primary"
          id="loginBtn"
          type="submit">
          Войти
        </button>

        <button
          class="textBtn"
          id="recoverBtn"
          type="button">
          Забыл пароль?
        </button>

        <button
          class="textBtn"
          id="registerBtn"
          type="button">
          Создать аккаунт
        </button>

        <div
          class="loginError"
          id="loginError">
        </div>

      </form>
    </section>
  </div>`;

  document.getElementById('recoverBtn').onclick=recovery;

  document.getElementById('registerBtn').onclick=()=>{
    go('/register');
  };

  document.getElementById('loginForm').onsubmit=async e=>{
    e.preventDefault();

    const btn=document.getElementById('loginBtn');
    const err=document.getElementById('loginError');
    const code=document.getElementById('code').value.trim();

    err.textContent='';

    if(!/^\d{4,12}$/.test(code)){
      err.textContent='Пароль должен содержать 4–12 цифр.';
      return;
    }

    btn.disabled=true;
    btn.textContent='Проверяем…';

    try{

      const r=await fetch(LOGIN_FUNCTION,{
        method:'POST',

        headers:{
          'Content-Type':'application/json',
          'apikey':SUPABASE_KEY
        },

        body:JSON.stringify({
          first_name:
            document.getElementById('firstName').value.trim(),

          last_name:
            document.getElementById('lastName').value.trim(),

          code
        })
      });

      const d=await r.json();

      if(!r.ok||!d.session){
        throw new Error(d?.error||'login_failed');
      }

      const {error}=await sb.auth.setSession(d.session);

      if(error)throw error;

      currentUser=d.user;

      if(d.recovery_configured===false){
        recoverySetup();
      }else{
        go('/');
      }

    }catch(e){

      console.error('BeerFactory login:',e);

      err.textContent=
        'Не удалось войти. Проверь имя, фамилию и пароль.';

      btn.disabled=false;
      btn.textContent='Войти';
    }
  };
};


function register(){

  document.getElementById('app').innerHTML=`
  <div class="loginWrap">
    <section class="loginCard">

      <button
        class="textBtn backBtn"
        id="backLogin"
        type="button">
        ← Вернуться ко входу
      </button>

      <div class="eyebrow">НОВЫЙ СОТРУДНИК</div>

      <h1>Создать аккаунт</h1>

      <p>
        Нужны только имя, фамилия,
        пароль и секретный код.
      </p>

      <form id="registerForm">

        <input
          class="search"
          id="regFirst"
          placeholder="Имя"
          required
          maxlength="80">

        <input
          class="search"
          id="regLast"
          placeholder="Фамилия"
          required
          maxlength="80">

        <input
          class="search"
          id="regPassword"
          inputmode="numeric"
          type="password"
          placeholder="Пароль · 4–12 цифр"
          required
          maxlength="12">

        <input
          class="search"
          id="regPassword2"
          inputmode="numeric"
          type="password"
          placeholder="Повторите пароль"
          required
          maxlength="12">

        <input
          class="search"
          id="regSecret"
          inputmode="numeric"
          type="password"
          placeholder="Секретный код · 4–12 цифр"
          required
          maxlength="12">

        <input
          class="search"
          id="regSecret2"
          inputmode="numeric"
          type="password"
          placeholder="Повторите секретный код"
          required
          maxlength="12">

        <button
          class="btn primary"
          id="regSubmit"
          type="submit">
          Создать аккаунт
        </button>

        <div
          class="loginError"
          id="regError">
        </div>

      </form>
    </section>
  </div>`;

  document.getElementById('backLogin').onclick=()=>{
    go('/login');
  };

  document.getElementById('registerForm').onsubmit=async e=>{

    e.preventDefault();

    const err=document.getElementById('regError');
    const btn=document.getElementById('regSubmit');

    const password=
      document.getElementById('regPassword').value.trim();

    const password2=
      document.getElementById('regPassword2').value.trim();

    const secret_code=
      document.getElementById('regSecret').value.trim();

    const secret2=
      document.getElementById('regSecret2').value.trim();

    err.textContent='';

    if(!/^\d{4,12}$/.test(password)){
      err.textContent=
        'Пароль должен содержать 4–12 цифр.';
      return;
    }

    if(password!==password2){
      err.textContent='Пароли не совпадают.';
      return;
    }

    if(!/^\d{4,12}$/.test(secret_code)){
      err.textContent=
        'Секретный код должен содержать 4–12 цифр.';
      return;
    }

    if(secret_code!==secret2){
      err.textContent='Секретные коды не совпадают.';
      return;
    }

    btn.disabled=true;
    btn.textContent='Создаём…';

    try{

      const r=await fetch(REGISTER_FUNCTION,{

        method:'POST',

        headers:{
          'Content-Type':'application/json',
          'apikey':SUPABASE_KEY
        },

        body:JSON.stringify({

          first_name:
            document.getElementById('regFirst')
              .value.trim(),

          last_name:
            document.getElementById('regLast')
              .value.trim(),

          password,
          secret_code
        })
      });

      const d=await r.json();

      if(!r.ok||!d.ok){
        throw new Error(
          d?.error||'registration_failed'
        );
      }

      sessionStorage.setItem(
        'bf-register-ok',
        '1'
      );

      go('/login');

      setTimeout(()=>{
        toast(
          'Аккаунт создан. Теперь войдите.'
        );
      },50);

    }catch(e){

      console.error(
        'BeerFactory registration:',
        e
      );

      err.textContent=
        e.message==='user_exists'
          ? 'Сотрудник с таким именем и фамилией уже существует.'
          : 'Не удалось создать аккаунт.';

      btn.disabled=false;
      btn.textContent='Создать аккаунт';
    }
  };
}


recovery=function(){

  document.getElementById('app').innerHTML=`
  <div class="loginWrap">
    <section class="loginCard">

      <button
        class="textBtn backBtn"
        id="backLogin"
        type="button">
        ← Вернуться ко входу
      </button>

      <div class="eyebrow">
        ВОССТАНОВЛЕНИЕ ДОСТУПА
      </div>

      <h1>Забыл пароль?</h1>

      <p>
        Введите имя, фамилию,
        секретный код и новый пароль.
      </p>

      <form id="recoverForm">

        <input
          class="search"
          id="rFirstName"
          placeholder="Имя"
          required
          maxlength="80">

        <input
          class="search"
          id="rLastName"
          placeholder="Фамилия"
          required
          maxlength="80">

        <input
          class="search"
          id="recoveryCode"
          inputmode="numeric"
          type="password"
          placeholder="Секретный код"
          required
          maxlength="12">

        <input
          class="search"
          id="newCode"
          inputmode="numeric"
          type="password"
          placeholder="Новый пароль"
          required
          maxlength="12">

        <button
          class="btn primary"
          id="recoverSubmit"
          type="submit">
          Изменить пароль
        </button>

        <div
          class="loginError"
          id="recoverError">
        </div>

      </form>
    </section>
  </div>`;

  document.getElementById('backLogin').onclick=()=>{
    go('/login');
  };

  document.getElementById('recoverForm').onsubmit=
    async e=>{

    e.preventDefault();

    const btn=
      document.getElementById('recoverSubmit');

    const err=
      document.getElementById('recoverError');

    const rc=
      document.getElementById('recoveryCode')
        .value.trim();

    const nc=
      document.getElementById('newCode')
        .value.trim();

    err.textContent='';

    if(
      !/^\d{4,12}$/.test(rc) ||
      !/^\d{4,12}$/.test(nc)
    ){
      err.textContent=
        'Коды должны содержать 4–12 цифр.';
      return;
    }

    btn.disabled=true;
    btn.textContent='Сохраняем…';

    try{

      const {data:d,error:rpcError}=
        await sb.rpc(RECOVER_RPC,{

          p_first_name:
            document.getElementById('rFirstName')
              .value.trim(),

          p_last_name:
            document.getElementById('rLastName')
              .value.trim(),

          p_recovery_code:rc,
          p_new_code:nc
        });

      if(rpcError||!d?.ok){
        throw new Error(
          d?.error ||
          rpcError?.message ||
          'recovery_failed'
        );
      }

      toast('Пароль изменён');

      go('/login');

    }catch(e){

      err.textContent=
        e.message==='rate_limited'
          ? 'Слишком много попыток. Повторите позже.'
          : e.message==='invalid_recovery_code'
          ? 'Секретный код не подошёл.'
          : 'Не удалось изменить пароль.';

      btn.disabled=false;
      btn.textContent='Изменить пароль';
    }
  };
};


recoverySetup=function(){

  document.getElementById('app').innerHTML=`
  <div class="loginWrap">
    <section class="loginCard recoveryResult">

      <div class="eyebrow">
        ЗАЩИТА АККАУНТА
      </div>

      <h1>Создайте секретный код</h1>

      <p>
        Он понадобится,
        если вы забудете пароль.
      </p>

      <form id="setupRecoveryForm">

        <input
          class="search"
          id="setupRecoveryCode"
          inputmode="numeric"
          type="password"
          placeholder="Секретный код · 4–12 цифр"
          required
          maxlength="12">

        <input
          class="search"
          id="setupRecoveryCode2"
          inputmode="numeric"
          type="password"
          placeholder="Повторите секретный код"
          required
          maxlength="12">

        <button
          class="btn primary"
          id="setupRecoveryBtn"
          type="submit">
          Сохранить
        </button>

        <div
          class="loginError"
          id="setupRecoveryError">
        </div>

      </form>
    </section>
  </div>`;

  document.getElementById(
    'setupRecoveryForm'
  ).onsubmit=async e=>{

    e.preventDefault();

    const a=
      document.getElementById(
        'setupRecoveryCode'
      ).value.trim();

    const b=
      document.getElementById(
        'setupRecoveryCode2'
      ).value.trim();

    const btn=
      document.getElementById(
        'setupRecoveryBtn'
      );

    const err=
      document.getElementById(
        'setupRecoveryError'
      );

    if(
      !/^\d{4,12}$/.test(a) ||
      a!==b
    ){
      err.textContent=
        'Введите одинаковый секретный код из 4–12 цифр.';
      return;
    }

    btn.disabled=true;
    btn.textContent='Сохраняем…';

    try{

      const {
        data:{session}
      }=await sb.auth.getSession();

      if(!session)throw Error();

      const r=await fetch(
        SET_RECOVERY_FUNCTION,
        {
          method:'POST',

          headers:{
            'Content-Type':'application/json',
            'apikey':SUPABASE_KEY,
            'Authorization':
              'Bearer '+session.access_token
          },

          body:JSON.stringify({
            recovery_code:a
          })
        }
      );

      if(!r.ok)throw Error();

      go('/');

    }catch{

      err.textContent=
        'Не удалось сохранить секретный код.';

      btn.disabled=false;
      btn.textContent='Сохранить';
    }
  };
};


async function profile(){

  const {
    data:{session}
  }=await sb.auth.getSession();

  if(!session){
    go('/login');
    return;
  }

  shell(`
    <div class="pageTitle">
      <div class="eyebrow">
        ЛИЧНЫЙ ПРОФИЛЬ
      </div>

      <h1>Мой профиль</h1>

      <p>
        Рабочая карточка сотрудника.
      </p>
    </div>

    <section
      class="card cardPad"
      id="profileCard">

      <div class="empty">
        Загрузка…
      </div>

    </section>
  `,'/');

  try{

    const r=await fetch(
      PROFILE_FUNCTION,
      {
        headers:{
          'apikey':SUPABASE_KEY,
          'Authorization':
            'Bearer '+session.access_token
        }
      }
    );

    const d=await r.json();

    if(!r.ok||!d.profile){
      throw Error();
    }

    const p=d.profile;

    document.getElementById(
      'profileCard'
    ).innerHTML=`

      <div class="eyebrow">
        ${
          p.role==='admin'
            ? 'АДМИНИСТРАТОР'
            : 'СОТРУДНИК'
        }
      </div>

      <h2>
        ${esc(p.first_name)}
        ${esc(p.last_name)}
      </h2>

      <form id="profileForm">

        <label>
          Дата рождения
        </label>

        <input
          class="search"
          id="birthDate"
          type="date"
          value="${esc(p.birth_date||'')}">

        <label>
          Должность
        </label>

        <input
          class="search"
          id="position"
          maxlength="80"
          placeholder="Например: бармен"
          value="${esc(p.position||'')}">

        <button
          class="btn primary"
          type="submit">
          Сохранить профиль
        </button>

        <div
          class="loginError"
          id="profileError">
        </div>

      </form>
    `;

    document.getElementById(
      'profileForm'
    ).onsubmit=async e=>{

      e.preventDefault();

      const err=
        document.getElementById(
          'profileError'
        );

      err.textContent='';

      const rr=await fetch(
        PROFILE_FUNCTION,
        {
          method:'PATCH',

          headers:{
            'Content-Type':'application/json',
            'apikey':SUPABASE_KEY,
            'Authorization':
              'Bearer '+session.access_token
          },

          body:JSON.stringify({

            birth_date:
              document.getElementById(
                'birthDate'
              ).value||null,

            position:
              document.getElementById(
                'position'
              ).value.trim()
          })
        }
      );

      if(rr.ok){
        toast('Профиль сохранён');
      }else{
        err.textContent=
          'Не удалось сохранить профиль.';
      }
    };

  }catch{

    document.getElementById(
      'profileCard'
    ).innerHTML=
      '<div class="empty">Не удалось загрузить профиль.</div>';
  }
}


const _baseRender=render;

render=async function(){

  const p=path();

  if(p==='/register'){
    register();
    return;
  }

  if(p==='/profile'){

    const {data}=
      await sb.auth.getSession();

    if(!data.session){
      login();
      return;
    }

    profile();
    return;
  }

  return _baseRender();
};