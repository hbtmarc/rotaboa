// ===================================================
// routeService.js — cálculo de rotas com cache local
// Sem dependências externas (apenas fetch browser)
// ===================================================

var RouteService = (function () {
  var _LS_CACHE = 'rotaboa.routeCache.v1';

  var _velocidades = {
    carro: 70,
    van: 70,
    onibus: 70,
    aereo: 700,
    trem: 90,
    barco: 35,
    caminhada: 4,
    outro: 50,
  };

  function _normalizar(str) {
    return String(str || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function _cacheKey(origem, destino, tipo) {
    return _normalizar(origem) + '|' + _normalizar(destino) + '|' + _normalizar(tipo || 'outro');
  }

  function _loadCache() {
    try {
      var raw = localStorage.getItem(_LS_CACHE);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return (parsed && typeof parsed === 'object') ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function _saveCache(cache) {
    try {
      localStorage.setItem(_LS_CACHE, JSON.stringify(cache));
    } catch (e) {}
  }

  function _round2(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
  }

  function _fmtDuracao(min) {
    var m = Math.max(1, Math.round(Number(min) || 0));
    var h = Math.floor(m / 60);
    var r = m % 60;
    if (h && r) return h + 'h ' + r + 'min';
    if (h) return h + 'h';
    return r + 'min';
  }

  function _haversineKm(lat1, lon1, lat2, lon2) {
    function toRad(d) { return d * Math.PI / 180; }
    var R = 6371;
    var dLat = toRad(lat2 - lat1);
    var dLon = toRad(lon2 - lon1);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function _estimarDuracaoTexto(distKm, tipo) {
    var vel = _velocidades[tipo] || _velocidades.outro;
    var min = vel > 0 ? ((Number(distKm) || 0) / vel) * 60 : 0;
    return _fmtDuracao(min);
  }

  function _fetchJson(url) {
    return fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    });
  }

  function _geocode(local) {
    var q = encodeURIComponent(local);
    var url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=pt-BR&q=' + q;
    return _fetchJson(url).then(function (arr) {
      if (!Array.isArray(arr) || !arr.length) throw new Error('Local não encontrado');
      return {
        lat: Number(arr[0].lat),
        lon: Number(arr[0].lon),
        nome: arr[0].display_name || local,
      };
    });
  }

  function _routeDriving(orig, dest) {
    var url = 'https://router.project-osrm.org/route/v1/driving/' +
      orig.lon + ',' + orig.lat + ';' + dest.lon + ',' + dest.lat + '?overview=false';
    return _fetchJson(url).then(function (res) {
      if (!res || !Array.isArray(res.routes) || !res.routes.length) {
        throw new Error('Sem rota');
      }
      var rt = res.routes[0];
      return {
        distanciaKm: _round2((Number(rt.distance) || 0) / 1000),
        duracaoEstimada: _fmtDuracao((Number(rt.duration) || 0) / 60),
      };
    });
  }

  function calcular(origem, destino, tipo) {
    var key = _cacheKey(origem, destino, tipo);
    var cache = _loadCache();
    if (cache[key]) {
      return Promise.resolve(Object.assign({}, cache[key], { fromCache: true }));
    }

    var t = _normalizar(tipo || 'outro');

    return Promise.all([_geocode(origem), _geocode(destino)]).then(function (coords) {
      var o = coords[0];
      var d = coords[1];

      if (t === 'aereo') {
        var distAereo = _round2(_haversineKm(o.lat, o.lon, d.lat, d.lon));
        var outAereo = {
          distanciaKm: distAereo,
          duracaoEstimada: _estimarDuracaoTexto(distAereo, 'aereo'),
          calculoModo: 'auto',
          calculoMensagem: 'Calculado automaticamente',
        };
        cache[key] = outAereo;
        _saveCache(cache);
        return outAereo;
      }

      return _routeDriving(o, d).then(function (out) {
        var result = {
          distanciaKm: out.distanciaKm,
          duracaoEstimada: out.duracaoEstimada,
          calculoModo: 'auto',
          calculoMensagem: 'Calculado automaticamente',
        };
        cache[key] = result;
        _saveCache(cache);
        return result;
      }).catch(function () {
        var distEst = _round2(_haversineKm(o.lat, o.lon, d.lat, d.lon));
        var estimado = {
          distanciaKm: distEst,
          duracaoEstimada: _estimarDuracaoTexto(distEst, t),
          calculoModo: 'manual',
          calculoMensagem: 'Não foi possível calcular automaticamente. Preencha distância e duração manualmente.',
        };
        cache[key] = estimado;
        _saveCache(cache);
        return estimado;
      });
    }).catch(function () {
      return {
        distanciaKm: null,
        duracaoEstimada: '',
        calculoModo: 'manual',
        calculoMensagem: 'Não foi possível calcular automaticamente. Preencha distância e duração manualmente.',
      };
    });
  }

  return {
    calcular: calcular,
  };
})();
