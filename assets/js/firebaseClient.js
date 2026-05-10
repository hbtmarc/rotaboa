// ===================================================
// firebaseClient.js — Preparação de conexão Firebase
// Usa Firebase CDN via import dinâmico (sem npm/build)
// ===================================================

var FirebaseClient = (function () {
  var _LS_FIREBASE_CONFIG = 'rotaboa.firebase.config.v1';
  var _LS_FIREBASE_STATUS = 'rotaboa.firebase.status.v1';
  var _APP_NAME = 'rotaboa-main';

  var _sdkApp = null;
  var _sdkAuth = null;
  var _sdkFirestore = null;
  var _appInstancia = null;
  var _authInstancia = null;
  var _firestoreInstancia = null;
  var _authUserAtual = null;

  function _erro(msg) {
    var e = new Error(msg);
    e.friendly = msg;
    return e;
  }

  function _lerJSON(chave, fallback) {
    try {
      var raw = localStorage.getItem(chave);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function _salvarJSON(chave, valor) {
    localStorage.setItem(chave, JSON.stringify(valor));
  }

  function _normalizarConfig(config) {
    config = config || {};
    return {
      apiKey: String(config.apiKey || '').trim(),
      authDomain: String(config.authDomain || '').trim(),
      projectId: String(config.projectId || '').trim(),
      storageBucket: String(config.storageBucket || '').trim(),
      messagingSenderId: String(config.messagingSenderId || '').trim(),
      appId: String(config.appId || '').trim(),
      databaseURL: String(config.databaseURL || '').trim(),
      measurementId: String(config.measurementId || '').trim(),
    };
  }

  function _temConfigMinima(config) {
    return !!(config && config.apiKey && config.authDomain && config.projectId && config.appId);
  }

  async function _carregarSdkApp() {
    if (_sdkApp) return _sdkApp;
    _sdkApp = await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js');
    return _sdkApp;
  }

  async function _carregarSdkAuth() {
    if (_sdkAuth) return _sdkAuth;
    _sdkAuth = await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js');
    return _sdkAuth;
  }

  async function _carregarSdkFirestore() {
    if (_sdkFirestore) return _sdkFirestore;
    _sdkFirestore = await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js');
    return _sdkFirestore;
  }

  async function getFirebaseApp() {
    var config = getFirebaseConfig();
    if (!config || !_temConfigMinima(config)) {
      throw _erro('Configuração Firebase incompleta para autenticação.');
    }

    var appSdk = await _carregarSdkApp();
    var apps = appSdk.getApps();
    for (var i = 0; i < apps.length; i++) {
      if (apps[i].name === _APP_NAME) {
        _appInstancia = apps[i];
        return _appInstancia;
      }
    }

    _appInstancia = appSdk.initializeApp(config, _APP_NAME);
    return _appInstancia;
  }

  async function getFirebaseAuth() {
    if (_authInstancia) return _authInstancia;
    var authSdk = await _carregarSdkAuth();
    var app = await getFirebaseApp();
    _authInstancia = authSdk.getAuth(app);
    return _authInstancia;
  }

  async function getFirestoreDb() {
    if (_firestoreInstancia) return _firestoreInstancia;
    var fsSdk = await _carregarSdkFirestore();
    var app = await getFirebaseApp();
    _firestoreInstancia = fsSdk.getFirestore(app);
    return _firestoreInstancia;
  }

  function getCurrentUser() {
    return _authUserAtual;
  }

  async function loginWithEmail(email, password) {
    if (!email || !password) {
      throw _erro('Informe e-mail e senha para entrar.');
    }
    var auth = await getFirebaseAuth();
    var authSdk = await _carregarSdkAuth();
    var cred = await authSdk.signInWithEmailAndPassword(auth, String(email).trim(), String(password));
    _authUserAtual = cred.user || null;
    return _authUserAtual;
  }

  async function registerWithEmail(email, password) {
    if (!email || !password) {
      throw _erro('Informe e-mail e senha para criar conta.');
    }
    var auth = await getFirebaseAuth();
    var authSdk = await _carregarSdkAuth();
    var cred = await authSdk.createUserWithEmailAndPassword(auth, String(email).trim(), String(password));
    _authUserAtual = cred.user || null;
    return _authUserAtual;
  }

  async function loginWithGoogle() {
    var auth = await getFirebaseAuth();
    var authSdk = await _carregarSdkAuth();
    var provider = new authSdk.GoogleAuthProvider();
    var cred = await authSdk.signInWithPopup(auth, provider);
    _authUserAtual = cred.user || null;
    return _authUserAtual;
  }

  async function logoutUser() {
    var auth = await getFirebaseAuth();
    var authSdk = await _carregarSdkAuth();
    await authSdk.signOut(auth);
    _authUserAtual = null;
    return true;
  }

  async function onAuthChange(callback) {
    if (typeof callback !== 'function') {
      return function () {};
    }

    var config = getFirebaseConfig();
    if (!config || !_temConfigMinima(config)) {
      _authUserAtual = null;
      callback(null);
      return function () {};
    }

    var auth = await getFirebaseAuth();
    var authSdk = await _carregarSdkAuth();
    return authSdk.onAuthStateChanged(auth, function (user) {
      _authUserAtual = user || null;
      callback(_authUserAtual);
    });
  }

  async function uploadAppState(uid, payload) {
    if (!uid) throw _erro('Usuário não autenticado para sincronização.');
    var db = await getFirestoreDb();
    var fsSdk = await _carregarSdkFirestore();
    var refDoc = fsSdk.doc(db, 'users', String(uid), 'appState', 'main');
    await fsSdk.setDoc(refDoc, Object.assign({}, payload || {}), { merge: true });
    return true;
  }

  function _temConfigSalva(config) {
    return !!(config && typeof config === 'object');
  }

  function _setStatus(status) {
    _salvarJSON(_LS_FIREBASE_STATUS, {
      mode: status.mode || 'local',
      message: status.message || '',
      updatedAt: new Date().toISOString(),
    });
  }

  function _getStatusInterno() {
    var config = getFirebaseConfig();
    var salvo = _lerJSON(_LS_FIREBASE_STATUS, null);

    if (!_temConfigSalva(config)) {
      return {
        mode: 'local',
        label: 'Local',
        message: 'Modo local ativo.',
      };
    }

    if (salvo && salvo.mode === 'online') {
      return {
        mode: 'online',
        label: 'Firebase online',
        message: salvo.message || 'Conexão com Firebase validada.',
      };
    }

    return {
      mode: 'configured',
      label: 'Firebase configurado',
      message: (salvo && salvo.message) || 'Configuração salva. Persistência principal ainda em modo local.',
    };
  }

  function getFirebaseConfig() {
    var config = _lerJSON(_LS_FIREBASE_CONFIG, null);
    if (!config) return null;
    config = _normalizarConfig(config);
    return config;
  }

  function saveFirebaseConfig(config) {
    var normalizado = _normalizarConfig(config);
    _salvarJSON(_LS_FIREBASE_CONFIG, normalizado);
    _setStatus({
      mode: 'configured',
      message: 'Configuração Firebase salva.',
    });
    return normalizado;
  }

  function clearFirebaseConfig() {
    localStorage.removeItem(_LS_FIREBASE_CONFIG);
    localStorage.removeItem(_LS_FIREBASE_STATUS);
    return true;
  }

  function getFirebaseStatus() {
    return _getStatusInterno();
  }

  async function testFirebaseConnection() {
    var config = getFirebaseConfig();
    if (!config || !_temConfigMinima(config)) {
      _setStatus({
        mode: 'configured',
        message: 'Preencha e salve uma configuração Firebase válida antes do teste.',
      });
      return {
        ok: false,
        code: 'missing-config',
        message: 'Configuração Firebase incompleta. Verifique os campos obrigatórios.',
      };
    }

    if (!config.databaseURL) {
      _setStatus({
        mode: 'configured',
        message: 'databaseURL não informado. Teste de Realtime Database indisponível.',
      });
      return {
        ok: false,
        code: 'missing-database-url',
        message: 'Informe o databaseURL para testar conexão com o Realtime Database.',
      };
    }

    try {
      var appSdk = await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js');
      var dbSdk = await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js');

      var appName = 'rotaboa-firebase-test';
      var app = null;
      var apps = appSdk.getApps();
      for (var i = 0; i < apps.length; i++) {
        if (apps[i].name === appName) {
          app = apps[i];
          break;
        }
      }
      if (!app) {
        app = appSdk.initializeApp(config, appName);
      }

      var db = dbSdk.getDatabase(app);
      await dbSdk.get(dbSdk.ref(db, '/'));

      _setStatus({
        mode: 'online',
        message: 'Conexão com Firebase realizada com sucesso.',
      });

      return {
        ok: true,
        code: 'ok',
        message: 'Conexão com Firebase validada com sucesso.',
      };
    } catch (error) {
      var msg = String((error && error.message) || 'Erro desconhecido');
      var friendly = 'Não foi possível validar a conexão com Firebase.';

      if (msg.toLowerCase().indexOf('permission_denied') !== -1) {
        friendly = 'Firebase respondeu, mas as regras do Realtime Database bloquearam acesso de leitura. Verifique as regras.';
      } else if (msg.toLowerCase().indexOf('database') !== -1 || msg.toLowerCase().indexOf('url') !== -1) {
        friendly = 'Configuração de Realtime Database inválida. Confira o databaseURL e o projeto.';
      }

      _setStatus({
        mode: 'configured',
        message: friendly,
      });

      return {
        ok: false,
        code: 'connection-error',
        message: friendly,
        debug: msg,
      };
    }
  }

  return {
    getFirebaseConfig: getFirebaseConfig,
    saveFirebaseConfig: saveFirebaseConfig,
    clearFirebaseConfig: clearFirebaseConfig,
    getFirebaseStatus: getFirebaseStatus,
    testFirebaseConnection: testFirebaseConnection,
    getFirebaseApp: getFirebaseApp,
    getFirebaseAuth: getFirebaseAuth,
    getFirestoreDb: getFirestoreDb,
    getCurrentUser: getCurrentUser,
    loginWithEmail: loginWithEmail,
    registerWithEmail: registerWithEmail,
    loginWithGoogle: loginWithGoogle,
    logoutUser: logoutUser,
    onAuthChange: onAuthChange,
    uploadAppState: uploadAppState,
  };
})();
