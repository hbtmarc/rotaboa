// ===================================================
// mapsService.js — Google Maps opcional (sem npm)
// Carregamento dinâmico + autocomplete + cálculo de rota.
//
// APIs usadas:
//   • PlaceAutocompleteElement  (Places API nova, substituiu Autocomplete)
//   • Routes API REST v2        (substituiu DirectionsService)
// ===================================================

var MapsService = (function () {
  var _scriptPromise  = null;
  var _placesLibPromise = null;
  var _lastError = '';

  // ---- Chave de API -------------------------------------------

  function _getApiKey() {
    return 'AIzaSyDS4rKFaIDfnbKj3MoUA1WXXjfl3kfmvGI';
  }

  function hasApiKey() {
    return !!_getApiKey();
  }

  // ---- Carregamento do script ----------------------------------
  // Usa loading=async + importLibrary para carregar só o necessário.

  function _loadScript() {
    if (_scriptPromise) return _scriptPromise;

    var key = _getApiKey();
    if (!key) {
      _lastError = 'Google Maps API key não configurada.';
      return Promise.resolve(false);
    }

    if (window.google && window.google.maps && typeof window.google.maps.importLibrary === 'function') {
      _scriptPromise = Promise.resolve(true);
      return _scriptPromise;
    }

    _scriptPromise = new Promise(function (resolve) {
      var script = document.createElement('script');
      script.src =
        'https://maps.googleapis.com/maps/api/js?key=' +
        encodeURIComponent(key) +
        '&loading=async';
      script.async = true;
      script.onload = function () { resolve(true); };
      script.onerror = function () {
        _lastError = 'Falha ao carregar Google Maps.';
        _scriptPromise = null;
        resolve(false);
      };
      document.head.appendChild(script);
    });

    return _scriptPromise;
  }

  // ---- Carrega biblioteca Places (importLibrary) ---------------

  function _loadPlaces() {
    if (_placesLibPromise) return _placesLibPromise;
    _placesLibPromise = _loadScript().then(function (ok) {
      if (!ok || !window.google || typeof window.google.maps.importLibrary !== 'function') {
        _lastError = 'Google Maps importLibrary indisponível.';
        return null;
      }
      return window.google.maps.importLibrary('places').catch(function () {
        _lastError = 'Falha ao carregar biblioteca Places.';
        return null;
      });
    });
    return _placesLibPromise;
  }

  function init() {
    return _loadScript();
  }

  // ---- Autocomplete (PlaceAutocompleteElement) -----------------
  //
  // Recebe um <input> existente, cria um PlaceAutocompleteElement
  // e o substitui no DOM. Retorna um adaptador compatível com
  // o antigo Autocomplete: addListener('place_changed') + getPlace().

  function setupAutocomplete(inputElement) {
    if (!inputElement) return Promise.resolve(null);

    return _loadPlaces().then(function (placesLib) {
      if (!placesLib || !placesLib.PlaceAutocompleteElement) {
        _lastError = 'PlaceAutocompleteElement não disponível.';
        return null;
      }
      try {
        var pac = new placesLib.PlaceAutocompleteElement({
          requestedLanguage: 'pt-BR',
          requestedRegion:   'br',
        });

        // Copia atributos visuais do input original
        if (inputElement.placeholder) pac.setAttribute('placeholder', inputElement.placeholder);
        if (inputElement.className)   pac.className = inputElement.className;
        pac.style.cssText = inputElement.style.cssText;

        // Substitui o input no DOM
        if (inputElement.parentNode) {
          inputElement.parentNode.replaceChild(pac, inputElement);
        }

        // Adaptador que mantém a interface do Autocomplete antigo
        var _callbacks  = {};
        var _lastPlace  = null;

        pac.addEventListener('gmp-placeselect', function (event) {
          var place = event.place;
          if (!place) return;
          place.fetchFields({ fields: ['formattedAddress', 'id', 'displayName'] })
            .then(function () {
              _lastPlace = {
                formatted_address: place.formattedAddress || '',
                place_id:          place.id               || '',
                name:              place.displayName       || place.formattedAddress || '',
              };
              var cbs = _callbacks['place_changed'] || [];
              for (var i = 0; i < cbs.length; i++) cbs[i]();
            })
            .catch(function () { _lastPlace = null; });
        });

        // Limpa placeId quando o usuário edita o texto manualmente
        pac.addEventListener('input', function () { _lastPlace = null; });

        return {
          addListener: function (evtName, cb) {
            if (!_callbacks[evtName]) _callbacks[evtName] = [];
            _callbacks[evtName].push(cb);
          },
          getPlace:  function () { return _lastPlace; },
          _element:  pac,
        };
      } catch (e) {
        _lastError = 'Erro ao criar PlaceAutocompleteElement: ' + (e && e.message || e);
        return null;
      }
    });
  }

  // ---- Formatação de duração ----------------------------------

  function _formatarDuracao(segundos) {
    var total = Math.max(0, Math.round(Number(segundos) || 0));
    var horas = Math.floor(total / 3600);
    var minutos = Math.round((total % 3600) / 60);
    if (horas > 0 && minutos > 0) return horas + 'h ' + minutos + 'min';
    if (horas > 0) return horas + 'h';
    return Math.max(1, minutos) + 'min';
  }

  // ---- Modo de viagem suportado por tipo ----------------------
  // Retorna string de travelMode (Routes API v2) ou null quando não suportado.

  function travelModeForTipo(tipo) {
    tipo = String(tipo || '').toLowerCase();
    if (['carro', 'van', 'onibus'].indexOf(tipo) !== -1) return 'DRIVE';
    if (tipo === 'caminhada') return 'WALK';
    return null; // aereo, trem, barco, outro → modo manual
  }

  // ---- Cálculo de rota (Routes API REST v2) -------------------
  // Substitui google.maps.DirectionsService (deprecado fev/2026).
  // Docs: https://developers.google.com/maps/documentation/routes

  function computeRoute(params) {
    _lastError = '';
    var origem       = String(params && params.origin             || '').trim();
    var destino      = String(params && params.destination        || '').trim();
    var placeIdOrig  = String(params && params.originPlaceId      || '').trim();
    var placeIdDest  = String(params && params.destinationPlaceId || '').trim();
    var travelMode   = String(params && params.travelMode         || 'DRIVE').toUpperCase();

    // Normaliza modos no formato antigo enviados por chamadores legados
    var _modeCompat = { DRIVING: 'DRIVE', WALKING: 'WALK', BICYCLING: 'BICYCLE', TRANSIT: 'TRANSIT' };
    if (_modeCompat[travelMode]) travelMode = _modeCompat[travelMode];

    if (!origem || !destino) {
      return Promise.reject(new Error('Informe origem e destino para calcular a rota.'));
    }

    var key = _getApiKey();
    if (!key) {
      return Promise.reject(new Error('Google Maps API key não configurada.'));
    }

    var body = {
      origin:      placeIdOrig  ? { placeId: placeIdOrig  } : { address: origem  },
      destination: placeIdDest  ? { placeId: placeIdDest  } : { address: destino },
      travelMode:  travelMode,
      computeAlternativeRoutes: false,
    };

    return fetch(
      'https://routes.googleapis.com/directions/v2:computeRoutes',
      {
        method:  'POST',
        headers: {
          'Content-Type':     'application/json',
          'X-Goog-Api-Key':   key,
          'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration',
        },
        body: JSON.stringify(body),
      }
    ).then(function (resp) {
      if (!resp.ok) {
        return resp.json().catch(function () { return {}; }).then(function (errBody) {
          var msg = (errBody && errBody.error && errBody.error.message) ||
            ('Routes API erro HTTP ' + resp.status);
          _lastError = msg;
          throw new Error(msg);
        });
      }
      return resp.json();
    }).then(function (data) {
      if (!data.routes || !data.routes.length) {
        var msg = 'Não foi possível calcular a rota (sem resultado).';
        _lastError = msg;
        throw new Error(msg);
      }
      var route  = data.routes[0];
      // duration vem como string "1234s" na Routes API v2
      var durSec = route.duration
        ? parseInt(String(route.duration).replace('s', ''), 10)
        : 0;
      return {
        distanceKm:   Math.round((route.distanceMeters / 1000) * 10) / 10,
        durationText: _formatarDuracao(durSec),
        routeSource:  'google',
      };
    });
  }

  // ---- bindSmartRouteInputs -----------------------------------
  // Ativa autocomplete nos dois campos de texto e dispara
  // cálculo automático quando ambos os lugares estão selecionados.
  //
  // opts: {
  //   originInput, destinationInput,
  //   getTipo()         → valor atual do select de tipo
  //   onCalculating()   → cálculo iniciado
  //   onRouteComputed({ distanceKm, durationText, routeSource })
  //   onError(msg)
  //   onManual()        → modo manual (tipo não suportado / lugar removido)
  // }
  //
  // Retorna controller: { retrigger(), getOriginPlace(), getDestinationPlace(), reset() }

  function bindSmartRouteInputs(opts) {
    opts = opts || {};
    var originInput      = opts.originInput;
    var destinationInput = opts.destinationInput;
    var getTipo          = typeof opts.getTipo         === 'function' ? opts.getTipo         : function () { return ''; };
    var onCalculating    = typeof opts.onCalculating   === 'function' ? opts.onCalculating   : function () {};
    var onRouteComputed  = typeof opts.onRouteComputed === 'function' ? opts.onRouteComputed : function () {};
    var onError          = typeof opts.onError         === 'function' ? opts.onError         : function () {};
    var onManual         = typeof opts.onManual        === 'function' ? opts.onManual        : function () {};

    var _originPlace      = null;  // { label, placeId }
    var _destinationPlace = null;
    var _computing        = false;
    var _debounceTimer    = null;

    function _doCompute() {
      if (_computing) return;
      if (!_originPlace || !_destinationPlace) return;

      var mode = travelModeForTipo(getTipo());
      if (!mode) { onManual(); return; }

      _computing = true;
      onCalculating();

      computeRoute({
        origin:               _originPlace.label,
        destination:          _destinationPlace.label,
        originPlaceId:        _originPlace.placeId,
        destinationPlaceId:   _destinationPlace.placeId,
        travelMode:           mode,
      }).then(function (res) {
        _computing = false;
        onRouteComputed(res);
      }).catch(function (e) {
        _computing = false;
        onError(e && e.message ? e.message : 'Não foi possível calcular a rota. Preencha distância e duração manualmente.');
      });
    }

    function _debounced() {
      clearTimeout(_debounceTimer);
      _debounceTimer = setTimeout(_doCompute, 250);
    }

    function _clearSide(side) {
      if (side === 'origin') _originPlace = null;
      else _destinationPlace = null;
      onManual();
    }

    // Inicializa após carregar Places
    _loadPlaces().then(function (placesLib) {
      if (!placesLib) { onManual(); return; }

      setupAutocomplete(originInput).then(function (ac) {
        if (!ac) { onManual(); }
        else {
          ac.addListener('place_changed', function () {
            var p = ac.getPlace();
            var label   = String(p && (p.formatted_address || p.name) || '').trim();
            var placeId = String(p && p.place_id || '').trim();
            if (!label || !placeId) { _clearSide('origin'); return; }
            _originPlace = { label: label, placeId: placeId };
            _debounced();
          });
        }
      });

      setupAutocomplete(destinationInput).then(function (ac) {
        if (!ac) { onManual(); }
        else {
          ac.addListener('place_changed', function () {
            var p = ac.getPlace();
            var label   = String(p && (p.formatted_address || p.name) || '').trim();
            var placeId = String(p && p.place_id || '').trim();
            if (!label || !placeId) { _clearSide('destination'); return; }
            _destinationPlace = { label: label, placeId: placeId };
            _debounced();
          });
        }
      });
    });

    return {
      // Chamar quando tipo muda — recalcula se ambos lugares já estão prontos
      retrigger: function () {
        clearTimeout(_debounceTimer);
        _debounceTimer = setTimeout(_doCompute, 150);
      },
      getOriginPlace:      function () { return _originPlace; },
      getDestinationPlace: function () { return _destinationPlace; },
      reset: function () {
        clearTimeout(_debounceTimer);
        _originPlace = null;
        _destinationPlace = null;
        _computing = false;
      },
    };
  }

  function getLastError() { return _lastError; }

  return {
    init:                 init,
    hasApiKey:            hasApiKey,
    setupAutocomplete:    setupAutocomplete,
    bindSmartRouteInputs: bindSmartRouteInputs,
    computeRoute:         computeRoute,
    travelModeForTipo:    travelModeForTipo,
    getLastError:         getLastError,
  };
})();
