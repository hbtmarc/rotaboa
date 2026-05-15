// ===================================================
// mapsService.js — Google Maps opcional (sem npm)
// Carregamento dinâmico + autocomplete + rota automática.
// ===================================================

var MapsService = (function () {
  var _scriptPromise = null;
  var _lastError = '';

  // ---- Chave de API -------------------------------------------

  function _getApiKey() {
    return 'AIzaSyDS4rKFaIDfnbKj3MoUA1WXXjfl3kfmvGI';
  }

  function hasApiKey() {
    return !!_getApiKey();
  }

  // ---- Carregamento do script ----------------------------------

  function _loadScript() {
    if (_scriptPromise) return _scriptPromise;

    var key = _getApiKey();
    if (!key) {
      _lastError = 'Google Maps API key não configurada.';
      return Promise.resolve(false);
    }

    if (window.google && window.google.maps && window.google.maps.places) {
      return Promise.resolve(true);
    }

    _scriptPromise = new Promise(function (resolve) {
      var script = document.createElement('script');
      script.src =
        'https://maps.googleapis.com/maps/api/js?key=' +
        encodeURIComponent(key) +
        '&libraries=places&loading=async';
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

  function init() {
    return _loadScript();
  }

  // ---- Autocomplete -------------------------------------------

  function setupAutocomplete(inputElement) {
    return _loadScript().then(function (ok) {
      if (!ok || !inputElement) return null;
      if (!window.google || !window.google.maps || !window.google.maps.places) return null;
      try {
        return new google.maps.places.Autocomplete(inputElement, {
          fields: ['formatted_address', 'place_id', 'name'],
        });
      } catch (e) {
        _lastError = 'Autocomplete indisponível.';
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
  // Retorna string de travelMode ou null quando não suportado.

  function travelModeForTipo(tipo) {
    tipo = String(tipo || '').toLowerCase();
    if (['carro', 'van', 'onibus'].indexOf(tipo) !== -1) return 'DRIVING';
    if (tipo === 'caminhada') return 'WALKING';
    return null; // aereo, trem, barco, outro → modo manual
  }

  // ---- Cálculo de rota (DirectionsService) --------------------

  function computeRoute(params) {
    _lastError = '';
    var origem      = String(params && params.origin            || '').trim();
    var destino     = String(params && params.destination       || '').trim();
    var placeIdOrig = String(params && params.originPlaceId     || '').trim();
    var placeIdDest = String(params && params.destinationPlaceId|| '').trim();
    var travelMode  = String(params && params.travelMode        || 'DRIVING').toUpperCase();

    if (!origem || !destino) {
      return Promise.reject(new Error('Informe origem e destino para calcular a rota.'));
    }

    return _loadScript().then(function (ok) {
      if (!ok || !window.google || !window.google.maps) {
        throw new Error(_lastError || 'Google Maps indisponível.');
      }

      var ds = new google.maps.DirectionsService();

      var gmMode = google.maps.TravelMode[travelMode] || google.maps.TravelMode.DRIVING;

      var request = {
        origin:      placeIdOrig ? { placeId: placeIdOrig } : origem,
        destination: placeIdDest ? { placeId: placeIdDest } : destino,
        travelMode:  gmMode,
        unitSystem:  google.maps.UnitSystem.METRIC,
      };

      return new Promise(function (resolve, reject) {
        ds.route(request, function (result, status) {
          if (status !== google.maps.DirectionsStatus.OK || !result) {
            var msg = 'Não foi possível calcular a rota (' + status + ').';
            _lastError = msg;
            return reject(new Error(msg));
          }
          try {
            var leg = result.routes[0].legs[0];
            resolve({
              distanceKm:   Math.round((leg.distance.value / 1000) * 10) / 10,
              durationText: _formatarDuracao(leg.duration.value),
              routeSource:  'google',
            });
          } catch (e) {
            reject(new Error('Resposta de rota inválida.'));
          }
        });
      });
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

    // Inicializa após carregar o script
    _loadScript().then(function (ok) {
      if (!ok) { onManual(); return; }

      setupAutocomplete(originInput).then(function (ac) {
        if (!ac) { onManual(); }
        else {
          ac.addListener('place_changed', function () {
            var p = ac.getPlace();
            var label   = String(p && (p.formatted_address || p.name) || (originInput && originInput.value) || '').trim();
            var placeId = String(p && p.place_id || '').trim();
            if (!label || !placeId) { _clearSide('origin'); return; }
            _originPlace = { label: label, placeId: placeId };
            _debounced();
          });
        }
        if (originInput) {
          originInput.addEventListener('input', function () { _clearSide('origin'); });
        }
      });

      setupAutocomplete(destinationInput).then(function (ac) {
        if (!ac) { onManual(); }
        else {
          ac.addListener('place_changed', function () {
            var p = ac.getPlace();
            var label   = String(p && (p.formatted_address || p.name) || (destinationInput && destinationInput.value) || '').trim();
            var placeId = String(p && p.place_id || '').trim();
            if (!label || !placeId) { _clearSide('destination'); return; }
            _destinationPlace = { label: label, placeId: placeId };
            _debounced();
          });
        }
        if (destinationInput) {
          destinationInput.addEventListener('input', function () { _clearSide('destination'); });
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
