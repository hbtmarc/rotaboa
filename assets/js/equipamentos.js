// =====================================================================
// equipamentos.js — Inventário de Equipamentos de Filmagem v1
// Módulo auxiliar do PlanoDiretor. Gerencia itens por viagem.
// =====================================================================
var EquipamentosModule = (function () {

  // ─── Id generator ────────────────────────────────────────────────
  function _id() {
    return 'eq' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
  }
  function _esc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ─── Tipos ────────────────────────────────────────────────────────
  var TIPOS = [
    {id:'camera',    label:'Câmera',         emoji:'📷'},
    {id:'lente',     label:'Lente',          emoji:'🔭'},
    {id:'audio',     label:'Áudio',          emoji:'🎙️'},
    {id:'estab',     label:'Estabilização',  emoji:'🎬'},
    {id:'drone',     label:'Drone',          emoji:'🚁'},
    {id:'luz',       label:'Iluminação',     emoji:'💡'},
    {id:'energia',   label:'Energia',        emoji:'🔋'},
    {id:'armazen',   label:'Armazenamento',  emoji:'💾'},
    {id:'suporte',   label:'Suporte',        emoji:'🦯'},
    {id:'celular',   label:'Celular',        emoji:'📱'},
    {id:'acess',     label:'Acessórios',     emoji:'🧰'},
    {id:'backup',    label:'Backup / HD',    emoji:'📦'},
  ];

  var STATUS_OPTS = [
    {id:'levar',     label:'Levar',    color:'#16a34a'},
    {id:'opcional',  label:'Opcional', color:'#ca8a04'},
    {id:'nao_levar', label:'Não levar',color:'#dc2626'},
  ];

  function _tipoInfo(id) {
    return TIPOS.find(function(t){ return t.id===id; })||{id:id,label:id,emoji:'📌'};
  }
  function _statusInfo(id) {
    return STATUS_OPTS.find(function(s){ return s.id===id; })||STATUS_OPTS[0];
  }

  // ─── Templates de kit ─────────────────────────────────────────────
  var TEMPLATES = {
    'celular_simples': {
      label: 'Celular simples',
      emoji: '📱',
      itens: [
        {nome:'Celular (smartphone)',        tipo:'celular', status:'levar', prioridade:'alta',  qtd:1, dono:''},
        {nome:'Carregador do celular',       tipo:'energia', status:'levar', prioridade:'alta',  qtd:1, dono:''},
        {nome:'Powerbank',                   tipo:'energia', status:'levar', prioridade:'alta',  qtd:1, dono:''},
        {nome:'Cabo USB-C / Lightning',      tipo:'acess',   status:'levar', prioridade:'alta',  qtd:2, dono:''},
        {nome:'Pano de limpeza de tela',     tipo:'acess',   status:'levar', prioridade:'media', qtd:1, dono:''},
        {nome:'Suporte de mão / grip ring',  tipo:'suporte', status:'opcional',prioridade:'baixa',qtd:1,dono:''},
      ]
    },
    'vlog_leve': {
      label: 'Vlog leve',
      emoji: '🎥',
      itens: [
        {nome:'Câmera (Sony ZV-E10 ou similar)', tipo:'camera', status:'levar', prioridade:'alta', qtd:1, dono:''},
        {nome:'Lente 23mm f/1.4',                tipo:'lente',  status:'levar', prioridade:'alta', qtd:1, dono:''},
        {nome:'Baterias da câmera (×2)',          tipo:'energia',status:'levar', prioridade:'alta', qtd:2, dono:''},
        {nome:'Cartão SD 128 GB UHS-II',          tipo:'armazen',status:'levar', prioridade:'alta', qtd:1, dono:''},
        {nome:'Carregador duplo de bateria',      tipo:'energia',status:'levar', prioridade:'alta', qtd:1, dono:''},
        {nome:'Microfone direcional (hot-shoe)',  tipo:'audio',  status:'levar', prioridade:'media',qtd:1, dono:''},
        {nome:'Gorilla pod / mini tripé',         tipo:'suporte',status:'levar', prioridade:'media',qtd:1, dono:''},
        {nome:'Pano de limpeza de óptica',        tipo:'acess',  status:'levar', prioridade:'alta', qtd:1, dono:''},
        {nome:'Celular (backup / reação)',         tipo:'celular',status:'levar', prioridade:'alta', qtd:1, dono:''},
        {nome:'Powerbank 20.000 mAh',             tipo:'energia',status:'levar', prioridade:'alta', qtd:1, dono:''},
      ]
    },
    'captacao_completa': {
      label: 'Captação completa',
      emoji: '🎬',
      itens: [
        {nome:'Câmera principal (Sony ZV-E10)',    tipo:'camera', status:'levar', prioridade:'alta', qtd:1, dono:''},
        {nome:'Lente 23mm f/1.4',                  tipo:'lente',  status:'levar', prioridade:'alta', qtd:1, dono:''},
        {nome:'Lente 15mm f/1.7 (grande angular)', tipo:'lente',  status:'levar', prioridade:'alta', qtd:1, dono:''},
        {nome:'Filtros ND (ND8 / ND64)',           tipo:'acess',  status:'levar', prioridade:'alta', qtd:1, dono:''},
        {nome:'Baterias da câmera (×3)',           tipo:'energia',status:'levar', prioridade:'alta', qtd:3, dono:''},
        {nome:'Cartão SD 128 GB UHS-II',           tipo:'armazen',status:'levar', prioridade:'alta', qtd:2, dono:''},
        {nome:'Cartão SD reserva 64 GB',           tipo:'armazen',status:'levar', prioridade:'alta', qtd:1, dono:''},
        {nome:'Carregador duplo de bateria',       tipo:'energia',status:'levar', prioridade:'alta', qtd:1, dono:''},
        {nome:'Gimbal (DJI OM6 ou similar)',       tipo:'estab',  status:'levar', prioridade:'alta', qtd:1, dono:''},
        {nome:'Tripé com cabeça fluida',           tipo:'suporte',status:'levar', prioridade:'media',qtd:1, dono:''},
        {nome:'Microfone lapela (clip-on)',         tipo:'audio',  status:'levar', prioridade:'alta', qtd:1, dono:''},
        {nome:'Microfone direcional (shotgun)',     tipo:'audio',  status:'levar', prioridade:'media',qtd:1, dono:''},
        {nome:'Wind-shield / deadcat',             tipo:'audio',  status:'levar', prioridade:'alta', qtd:1, dono:''},
        {nome:'Powerbank 20.000 mAh',             tipo:'energia',status:'levar', prioridade:'alta', qtd:1, dono:''},
        {nome:'Pano de limpeza de óptica',         tipo:'acess',  status:'levar', prioridade:'alta', qtd:1, dono:''},
        {nome:'HD externo SSD 1 TB',              tipo:'backup', status:'levar', prioridade:'alta', qtd:1, dono:''},
        {nome:'Celular (iPhone ou similar)',        tipo:'celular',status:'levar', prioridade:'alta', qtd:1, dono:''},
        {nome:'GoPro / action cam',                tipo:'camera', status:'opcional',prioridade:'media',qtd:1,dono:''},
      ]
    },
    'drone_camera': {
      label: 'Drone + câmera',
      emoji: '🚁',
      itens: [
        {nome:'Câmera principal',                  tipo:'camera', status:'levar', prioridade:'alta', qtd:1, dono:''},
        {nome:'Lente 23mm f/1.4',                  tipo:'lente',  status:'levar', prioridade:'alta', qtd:1, dono:''},
        {nome:'DJI Mini 4 Pro',                    tipo:'drone',  status:'levar', prioridade:'alta', qtd:1, dono:''},
        {nome:'Baterias do drone (×3)',            tipo:'energia',status:'levar', prioridade:'alta', qtd:3, dono:''},
        {nome:'Hélices reserva (1 set)',           tipo:'acess',  status:'levar', prioridade:'alta', qtd:1, dono:''},
        {nome:'Filtros ND para drone',             tipo:'acess',  status:'levar', prioridade:'alta', qtd:1, dono:''},
        {nome:'Baterias da câmera (×3)',           tipo:'energia',status:'levar', prioridade:'alta', qtd:3, dono:''},
        {nome:'Cartão SD 128 GB UHS-II',           tipo:'armazen',status:'levar', prioridade:'alta', qtd:2, dono:''},
        {nome:'Gimbal',                            tipo:'estab',  status:'levar', prioridade:'alta', qtd:1, dono:''},
        {nome:'HD externo SSD 1 TB',              tipo:'backup', status:'levar', prioridade:'alta', qtd:1, dono:''},
        {nome:'Powerbank 30.000 mAh',             tipo:'energia',status:'levar', prioridade:'alta', qtd:1, dono:''},
        {nome:'Celular (controle do drone)',        tipo:'celular',status:'levar', prioridade:'alta', qtd:1, dono:''},
      ]
    },
    'somente_iphone': {
      label: 'Somente iPhone',
      emoji: '📱',
      itens: [
        {nome:'iPhone 15 Pro Max',                 tipo:'celular',status:'levar', prioridade:'alta', qtd:1, dono:''},
        {nome:'MagSafe / carregador sem fio',      tipo:'energia',status:'levar', prioridade:'alta', qtd:1, dono:''},
        {nome:'Powerbank 20.000 mAh (MagSafe)',   tipo:'energia',status:'levar', prioridade:'alta', qtd:1, dono:''},
        {nome:'Lente clip-on grande angular',      tipo:'lente',  status:'levar', prioridade:'alta', qtd:1, dono:''},
        {nome:'Microfone de lapela (Lightning/C3)', tipo:'audio', status:'levar', prioridade:'alta', qtd:1, dono:''},
        {nome:'Gorilla pod / Joby mini',           tipo:'suporte',status:'levar', prioridade:'alta', qtd:1, dono:''},
        {nome:'Cabo Lightning / USB-C',            tipo:'acess',  status:'levar', prioridade:'alta', qtd:2, dono:''},
        {nome:'Pano de limpeza',                   tipo:'acess',  status:'levar', prioridade:'media',qtd:1, dono:''},
      ]
    },
  };

  // ─── Estado ───────────────────────────────────────────────────────
  var _tripId = null;
  var _viagem = null;
  var _participantes = [];
  var _itens = [];      // array of equipment items
  var _editingId = null;
  var _filterTipo = '';
  var _filterStatus = '';

  // ─── Load / save ─────────────────────────────────────────────────
  function _load() {
    if (!_tripId || !window.Store) return;
    _itens = Store.getEquipamentos(_tripId) || [];
  }
  function _save() {
    if (!_tripId || !window.Store) return;
    Store.salvarEquipamentos(_tripId, _itens.slice());
  }

  // ─── Helpers ─────────────────────────────────────────────────────
  function _levando() {
    return _itens.filter(function(i){ return i.status!=='nao_levar'; });
  }
  function _levandoTipos() {
    var tipos={};
    _levando().forEach(function(i){ tipos[i.tipo]=true; });
    return tipos;
  }
  function _hasType(type) { return !!_levandoTipos()[type]; }
  function _hasCamera()  { return _hasType('camera')||_hasType('celular'); }
  function _hasDrone()   { return _hasType('drone'); }
  function _hasGimbal()  { return _hasType('estab'); }
  function _hasAudio()   { return _hasType('audio'); }
  function _hasStorage() { return _hasType('armazen')||_hasType('backup'); }
  function _hasHD()      { return _hasType('backup'); }

  // ─── Render principal ─────────────────────────────────────────────
  function renderTab(viagem, participantes) {
    _tripId = viagem ? viagem.id : null;
    _viagem = viagem;
    _participantes = participantes||[];
    _load();

    var partOptions = '<option value="">— Ninguém definido —</option>'+
      _participantes.filter(function(p){ return p.ativo!==false; }).map(function(p){
        return '<option value="'+_esc(p.nome)+'">'+_esc(p.nome)+'</option>';
      }).join('');

    var levar  = _itens.filter(function(i){ return i.status==='levar'; });
    var opt    = _itens.filter(function(i){ return i.status==='opcional'; });
    var nao    = _itens.filter(function(i){ return i.status==='nao_levar'; });
    var pct    = _itens.length ? Math.round(levar.length/_itens.length*100) : 0;

    var h = '<div class="eq-root" id="eq-root">';

    // ── KPIs ──
    h += '<div class="eq-kpi-row">'+
      _kpi(String(levar.length),'Levando','#16a34a')+
      _kpi(String(opt.length),'Opcional','#ca8a04')+
      _kpi(String(nao.length),'Não levar','#dc2626')+
      _kpi(String(_itens.length),'Total','#6b7280')+
    '</div>';

    // ── Ações de topo ──
    h += '<div class="eq-top-acts">'+
      '<button class="eq-btn eq-btn--primary" onclick="EquipamentosModule.abrirModal(null)">'+
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'+
        'Adicionar item'+
      '</button>'+
      '<div class="eq-templates-wrap">'+
        '<span class="eq-templates-label">Templates:</span>'+
        Object.keys(TEMPLATES).map(function(k){
          var t=TEMPLATES[k];
          return '<button class="eq-tpl-btn" onclick="EquipamentosModule.aplicarTemplate(\''+k+'\')">'+t.emoji+' '+t.label+'</button>';
        }).join('')+
      '</div>'+
    '</div>';

    // ── Filtros ──
    h += '<div class="eq-filters">'+
      '<select class="eq-filter-sel" onchange="EquipamentosModule.filtrar(\'tipo\',this.value)" title="Filtrar por tipo">'+
        '<option value="">Todos os tipos</option>'+
        TIPOS.map(function(t){ return '<option value="'+t.id+'"'+(_filterTipo===t.id?' selected':'')+'>'+t.emoji+' '+t.label+'</option>'; }).join('')+
      '</select>'+
      '<select class="eq-filter-sel" onchange="EquipamentosModule.filtrar(\'status\',this.value)" title="Filtrar por status">'+
        '<option value="">Todos os status</option>'+
        STATUS_OPTS.map(function(s){ return '<option value="'+s.id+'"'+(_filterStatus===s.id?' selected':'')+'>'+s.label+'</option>'; }).join('')+
      '</select>'+
      (_itens.length?'<button class="eq-clear-btn" onclick="EquipamentosModule.limparTudo()">🗑 Limpar tudo</button>':'')+
    '</div>';

    // ── Lista agrupada por tipo ──
    if (!_itens.length) {
      h += '<div class="eq-empty">📦<p>Nenhum equipamento adicionado.<br>Escolha um template acima ou adicione manualmente.</p></div>';
    } else {
      var displayed = _itens.filter(function(i){
        if (_filterTipo   && i.tipo!==_filterTipo)     return false;
        if (_filterStatus && i.status!==_filterStatus)  return false;
        return true;
      });
      if (!displayed.length) {
        h += '<div class="eq-empty">🔍<p>Nenhum item corresponde ao filtro.</p></div>';
      } else {
        // Group by tipo
        var grupos = {};
        displayed.forEach(function(i){
          if(!grupos[i.tipo]) grupos[i.tipo]=[];
          grupos[i.tipo].push(i);
        });
        TIPOS.forEach(function(t){
          if(!grupos[t.id]) return;
          var gitens = grupos[t.id];
          h += '<div class="eq-group">'+
            '<div class="eq-group-head">'+
              '<span class="eq-group-emoji">'+t.emoji+'</span>'+
              '<span class="eq-group-label">'+t.label+'</span>'+
              '<span class="eq-group-count">'+gitens.length+'</span>'+
            '</div>'+
            '<div class="eq-group-items">';
          gitens.forEach(function(item){
            var si = _statusInfo(item.status);
            h += '<div class="eq-item" data-id="'+_esc(item.id)+'">'+
              '<div class="eq-item-left">'+
                '<span class="eq-status-dot" style="background:'+si.color+'"></span>'+
                '<div class="eq-item-info">'+
                  '<div class="eq-item-nome">'+_esc(item.nome)+(item.qtd>1?' ×'+item.qtd:'')+'</div>'+
                  '<div class="eq-item-meta">'+
                    '<span class="eq-prio-chip eq-prio-'+_esc(item.prioridade)+'">'+_prioLabel(item.prioridade)+'</span>'+
                    (item.dono?'<span class="eq-dono-chip">👤 '+_esc(item.dono)+'</span>':'')+
                    (item.obs?'<span class="eq-obs-chip">📝 '+_esc(item.obs.substring(0,40))+'</span>':'')+
                  '</div>'+
                '</div>'+
              '</div>'+
              '<div class="eq-item-acts">'+
                '<button class="eq-act-btn" onclick="EquipamentosModule.abrirModal(\''+item.id+'\')" title="Editar">✏️</button>'+
                '<button class="eq-act-btn eq-act-btn--del" onclick="EquipamentosModule.deletar(\''+item.id+'\')" title="Deletar">🗑</button>'+
              '</div>'+
            '</div>';
          });
          h += '</div></div>';
        });
      }
    }

    // ── Modal de edição (inline, hidden por padrão) ──
    h += _renderModal(partOptions);

    h += '</div>';
    return h;
  }

  function _kpi(val, label, color) {
    return '<div class="eq-kpi"><div class="eq-kpi-val" style="color:'+color+'">'+_esc(val)+'</div><div class="eq-kpi-label">'+_esc(label)+'</div></div>';
  }
  function _prioLabel(p) {
    return p==='alta'?'Alta':p==='media'?'Média':p==='baixa'?'Baixa':'—';
  }

  // ─── Modal ────────────────────────────────────────────────────────
  function _renderModal(partOptions) {
    return '<div class="eq-modal-overlay" id="eq-modal" style="display:none" onclick="EquipamentosModule.fecharModal(event)">'+
      '<div class="eq-modal-box">'+
        '<div class="eq-modal-head">'+
          '<span id="eq-modal-title">Adicionar equipamento</span>'+
          '<button class="eq-modal-close" onclick="EquipamentosModule.fecharModal(null)">×</button>'+
        '</div>'+
        '<form id="eq-form" onsubmit="EquipamentosModule.salvarForm(event)" autocomplete="off">'+
          '<input type="hidden" id="eq-form-id">'+
          '<div class="eq-form-row">'+
            '<label class="eq-label">Nome *</label>'+
            '<input class="eq-input" id="eq-form-nome" type="text" required placeholder="Ex: Sony ZV-E10, DJI Mini 4 Pro…">'+
          '</div>'+
          '<div class="eq-form-2col">'+
            '<div class="eq-form-row">'+
              '<label class="eq-label">Tipo *</label>'+
              '<select class="eq-input" id="eq-form-tipo" required>'+
                TIPOS.map(function(t){ return '<option value="'+t.id+'">'+t.emoji+' '+t.label+'</option>'; }).join('')+
              '</select>'+
            '</div>'+
            '<div class="eq-form-row">'+
              '<label class="eq-label">Status</label>'+
              '<select class="eq-input" id="eq-form-status">'+
                STATUS_OPTS.map(function(s){ return '<option value="'+s.id+'">'+s.label+'</option>'; }).join('')+
              '</select>'+
            '</div>'+
          '</div>'+
          '<div class="eq-form-2col">'+
            '<div class="eq-form-row">'+
              '<label class="eq-label">Quantidade</label>'+
              '<input class="eq-input" id="eq-form-qtd" type="number" min="1" max="99" value="1">'+
            '</div>'+
            '<div class="eq-form-row">'+
              '<label class="eq-label">Prioridade</label>'+
              '<select class="eq-input" id="eq-form-prio">'+
                '<option value="alta">Alta</option>'+
                '<option value="media" selected>Média</option>'+
                '<option value="baixa">Baixa</option>'+
              '</select>'+
            '</div>'+
          '</div>'+
          '<div class="eq-form-row">'+
            '<label class="eq-label">Responsável / Quem leva</label>'+
            '<select class="eq-input" id="eq-form-dono">'+partOptions+'</select>'+
          '</div>'+
          '<div class="eq-form-row">'+
            '<label class="eq-label">Observações</label>'+
            '<input class="eq-input" id="eq-form-obs" type="text" placeholder="Opcional — estado, peso, local na mala…">'+
          '</div>'+
          '<div class="eq-form-acts">'+
            '<button type="button" class="eq-btn eq-btn--outline" onclick="EquipamentosModule.fecharModal(null)">Cancelar</button>'+
            '<button type="submit" class="eq-btn eq-btn--primary">Salvar</button>'+
          '</div>'+
        '</form>'+
      '</div>'+
    '</div>';
  }

  // ─── API pública ──────────────────────────────────────────────────
  return {
    // init called by planoDiretor on each render
    renderTab: renderTab,

    abrirModal: function(id) {
      var modal = document.getElementById('eq-modal');
      var form  = document.getElementById('eq-form');
      var title = document.getElementById('eq-modal-title');
      if (!modal||!form) return;
      form.reset();
      document.getElementById('eq-form-id').value='';
      if (id) {
        var item = _itens.find(function(i){ return i.id===id; });
        if (!item) return;
        _editingId=id;
        title.textContent='Editar equipamento';
        document.getElementById('eq-form-id').value=id;
        document.getElementById('eq-form-nome').value=item.nome||'';
        document.getElementById('eq-form-tipo').value=item.tipo||'camera';
        document.getElementById('eq-form-status').value=item.status||'levar';
        document.getElementById('eq-form-qtd').value=item.qtd||1;
        document.getElementById('eq-form-prio').value=item.prioridade||'media';
        document.getElementById('eq-form-dono').value=item.dono||'';
        document.getElementById('eq-form-obs').value=item.obs||'';
      } else {
        _editingId=null;
        title.textContent='Adicionar equipamento';
        document.getElementById('eq-form-qtd').value=1;
      }
      modal.style.display='flex';
      setTimeout(function(){ var el=document.getElementById('eq-form-nome'); if(el) el.focus(); },100);
    },

    fecharModal: function(e) {
      if (e && e.target&&e.target.id!=='eq-modal') return;
      var modal = document.getElementById('eq-modal');
      if (modal) modal.style.display='none';
      _editingId=null;
    },

    salvarForm: function(e) {
      e.preventDefault();
      var nome   = document.getElementById('eq-form-nome').value.trim();
      var tipo   = document.getElementById('eq-form-tipo').value;
      var status = document.getElementById('eq-form-status').value;
      var qtd    = parseInt(document.getElementById('eq-form-qtd').value,10)||1;
      var prio   = document.getElementById('eq-form-prio').value;
      var dono   = document.getElementById('eq-form-dono').value;
      var obs    = document.getElementById('eq-form-obs').value.trim();
      var idVal  = document.getElementById('eq-form-id').value;
      if (!nome) return;
      if (idVal) {
        var idx = _itens.findIndex(function(i){ return i.id===idVal; });
        if (idx>=0) _itens[idx]=Object.assign({},_itens[idx],{nome:nome,tipo:tipo,status:status,qtd:qtd,prioridade:prio,dono:dono,obs:obs});
      } else {
        _itens.push({id:_id(),nome:nome,tipo:tipo,status:status,qtd:qtd,prioridade:prio,dono:dono,obs:obs});
      }
      _save();
      EquipamentosModule.fecharModal(null);
      _rerender();
    },

    deletar: function(id) {
      if (!window.confirm('Remover este equipamento?')) return;
      _itens = _itens.filter(function(i){ return i.id!==id; });
      _save();
      _rerender();
    },

    limparTudo: function() {
      if (!window.confirm('Remover todos os equipamentos desta viagem?')) return;
      _itens=[];
      _save();
      _rerender();
    },

    aplicarTemplate: function(tplKey) {
      var tpl = TEMPLATES[tplKey];
      if (!tpl) return;
      var msg = _itens.length
        ? 'Adicionar template "'+tpl.label+'" aos equipamentos existentes?\n(Clique em Cancelar para substituir tudo)'
        : null;
      var substituir = false;
      if (_itens.length) {
        var res = window.confirm(msg);
        if (!res) substituir = true;
      }
      var novos = tpl.itens.map(function(i){ return Object.assign({},i,{id:_id()}); });
      _itens = substituir ? novos : _itens.concat(novos);
      _save();
      _rerender();
    },

    filtrar: function(campo, valor) {
      if (campo==='tipo')   _filterTipo=valor;
      if (campo==='status') _filterStatus=valor;
      _rerender();
    },

    // ─── Getters para planoDiretor ─────────────────────────────────
    hasCamera:   function(){ return _hasCamera(); },
    hasDrone:    function(){ return _hasDrone(); },
    hasGimbal:   function(){ return _hasGimbal(); },
    hasAudio:    function(){ return _hasAudio(); },
    hasStorage:  function(){ return _hasStorage(); },
    hasHD:       function(){ return _hasHD(); },
    getTripId:   function(){ return _tripId; },
    getItens:    function(){ return _itens.slice(); },
    getLevando:  function(){ return _levando(); },

    // Returns suggested equipment for an activity category
    getSugeridosParaAtiv: function(cat) {
      var sugeridos=[];
      var M={
        natureza: ['camera','lente','drone','audio','estab'],
        trilha:   ['camera','lente','estab','audio','celular'],
        praia:    ['camera','lente','drone','celular','estab'],
        refeicao: ['camera','lente','audio','celular'],
        cultura:  ['camera','lente','audio','celular'],
        passeio:  ['camera','celular','estab','audio'],
        hospedagem:['camera','celular'],
        compra:   ['celular','camera'],
        esporte:  ['camera','estab','drone','celular'],
        transporte:['camera','celular','drone'],
      };
      var wanted=(M[cat]||['camera','celular']);
      var levando=_levando();
      wanted.forEach(function(tipo){
        var match=levando.find(function(i){ return i.tipo===tipo; });
        if (match) sugeridos.push(match);
      });
      return sugeridos;
    },

    // Get source list for edição tab
    getFontes: function(){
      var fontes=[];
      var levando=_levando();
      if (levando.find(function(i){ return i.tipo==='camera'; })) fontes.push('Câmera principal');
      if (levando.find(function(i){ return i.tipo==='drone'; }))  fontes.push('Drone');
      if (levando.find(function(i){ return i.tipo==='celular'; })) fontes.push('Celular');
      if (levando.find(function(i){ return i.tipo==='audio'; }))  fontes.push('Áudio externo');
      return fontes;
    },

    // Estimate GB based on equipment
    estimarGB: function(totalAtiv) {
      var levando=_levando();
      var gb=0;
      if (levando.find(function(i){ return i.tipo==='camera'; })) gb+=totalAtiv*4;
      if (levando.find(function(i){ return i.tipo==='drone'; }))  gb+=totalAtiv*2;
      if (levando.find(function(i){ return i.tipo==='celular'; })) gb+=totalAtiv;
      return gb||totalAtiv*3; // fallback
    },

    // Load for a new trip (called when planoDiretor tab switches)
    init: function(tripId, viagem, participantes) {
      _tripId=tripId;
      _viagem=viagem;
      _participantes=participantes||[];
      _filterTipo='';
      _filterStatus='';
      _load();
    },
  };

  function _rerender() {
    // Re-render only the eq-root div inside the active tab body
    var root = document.getElementById('eq-root');
    if (!root||!_viagem) return;
    var newHtml=renderTab(_viagem,_participantes);
    var tmp=document.createElement('div');
    tmp.innerHTML=newHtml;
    var newRoot=tmp.firstChild;
    root.parentNode.replaceChild(newRoot,root);
  }

})();
