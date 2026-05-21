/* weatherService.js — Integração Open-Meteo para RotaBoa
 * Sem dependências externas. Usa fetch nativo + localStorage para cache.
 * API: https://open-meteo.com/ (gratuita, sem chave)
 */
var WeatherService = (function () {

  // ── Constantes ────────────────────────────────────────────────────────────
  var _LS_PREFIX  = 'rotaboa.weather.v2.';  // v2: inclui _loc + TTL 5min
  var _CACHE_TTL  = 5 * 60 * 1000;           // 5 minutos (dados de temperatura atuais)
  var _GEO_URL    = 'https://geocoding-api.open-meteo.com/v1/search';
  var _FC_URL     = 'https://api.open-meteo.com/v1/forecast';

  // Memória (runtime): { [tripId]: { ts, data } }
  var _mem = {};

  // ── Tabela WMO → { icon, label } ─────────────────────────────────────────
  var _WMO = {
    0:  { icon: '☀️',  label: 'Céu limpo'          },
    1:  { icon: '🌤️', label: 'Mostly clear'        },
    2:  { icon: '⛅',  label: 'Parcialmente nublado'},
    3:  { icon: '☁️',  label: 'Nublado'             },
    45: { icon: '🌫️', label: 'Névoa'               },
    48: { icon: '🌫️', label: 'Névoa com geada'     },
    51: { icon: '🌦️', label: 'Chuvisco leve'       },
    53: { icon: '🌦️', label: 'Chuvisco'            },
    55: { icon: '🌦️', label: 'Chuvisco intenso'    },
    61: { icon: '🌧️', label: 'Chuva leve'          },
    63: { icon: '🌧️', label: 'Chuva'               },
    65: { icon: '🌧️', label: 'Chuva intensa'       },
    66: { icon: '🌧️', label: 'Chuva e gelo'        },
    67: { icon: '🌧️', label: 'Chuva e gelo intensa'},
    71: { icon: '🌨️', label: 'Neve leve'           },
    73: { icon: '🌨️', label: 'Neve'                },
    75: { icon: '❄️',  label: 'Neve intensa'        },
    77: { icon: '🌨️', label: 'Grãos de neve'       },
    80: { icon: '🌦️', label: 'Pancadas leves'      },
    81: { icon: '🌦️', label: 'Pancadas'            },
    82: { icon: '⛈️',  label: 'Pancadas fortes'    },
    85: { icon: '🌨️', label: 'Neve em pancadas'    },
    86: { icon: '🌨️', label: 'Neve intensa'        },
    95: { icon: '⛈️',  label: 'Trovoada'           },
    96: { icon: '⛈️',  label: 'Trovoada c/ granizo'},
    99: { icon: '⛈️',  label: 'Trovoada intensa'   },
  };

  function _wmoInfo(code) {
    return _WMO[code] || { icon: '🌡️', label: 'Clima desconhecido' };
  }

  // ── Cache helpers ─────────────────────────────────────────────────────────
  function _lsKey(tripId) { return _LS_PREFIX + tripId; }

  function _getCached(tripId) {
    // 1. Check memory cache first
    var mem = _mem[tripId];
    if (mem && (Date.now() - mem.ts) < _CACHE_TTL) return mem.data;
    // 2. Fall back to localStorage
    try {
      var raw = localStorage.getItem(_lsKey(tripId));
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && (Date.now() - (parsed.ts || 0)) < _CACHE_TTL) {
          _mem[tripId] = parsed;
          return parsed.data;
        }
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  function _setCache(tripId, data) {
    var payload = { ts: Date.now(), data: data };
    _mem[tripId] = payload;
    try { localStorage.setItem(_lsKey(tripId), JSON.stringify(payload)); } catch (e) { /* ignore */ }
  }

  // ── Geocoding (cidade → lat/lon) ──────────────────────────────────────────
  function _geocode(nome) {
    var url = _GEO_URL + '?name=' + encodeURIComponent(nome) + '&count=1&language=pt&format=json';
    return fetch(url).then(function (r) { return r.json(); }).then(function (j) {
      var r = j && j.results && j.results[0];
      if (!r) throw new Error('Cidade não encontrada: ' + nome);
      return { lat: r.latitude, lon: r.longitude };
    });
  }

  // ── Forecast fetch ────────────────────────────────────────────────────────
  function _fetchForecast(lat, lon) {
    var params = [
      'latitude=' + lat,
      'longitude=' + lon,
      'current=weather_code,temperature_2m',
      'daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,uv_index_max',
      'forecast_days=16',
      'timezone=auto',
      'wind_speed_unit=kmh',
    ].join('&');
    return fetch(_FC_URL + '?' + params)
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || !j.daily) throw new Error('Resposta inválida da API de previsão');
        // Normalize to { current, daily: [{date, code, max, min, rain, rainPct, wind, uv}] }
        var d = j.daily;
        var daily = (d.time || []).map(function (date, i) {
          return {
            date:    date,
            code:    d.weather_code[i],
            max:     Math.round(d.temperature_2m_max[i]),
            min:     Math.round(d.temperature_2m_min[i]),
            rain:    d.precipitation_sum ? Math.round(d.precipitation_sum[i] * 10) / 10 : 0,
            rainPct: d.precipitation_probability_max ? d.precipitation_probability_max[i] : 0,
            wind:    d.wind_speed_10m_max ? Math.round(d.wind_speed_10m_max[i]) : 0,
            uv:      d.uv_index_max ? d.uv_index_max[i] : 0,
          };
        });
        var cur = j.current || {};
        return {
          current: {
            code: cur.weather_code,
            temp: Math.round(cur.temperature_2m),
          },
          daily: daily,
        };
      });
  }

  // ── Precarregar (public) ──────────────────────────────────────────────────
  // Retorna Promise<data>. Usa cache se válido.
  function precarregar(viagem) {
    if (!viagem || !viagem.id) return Promise.resolve(null);
    var cached = _getCached(viagem.id);
    if (cached) return Promise.resolve(cached);

    // Decide como obter lat/lon
    var coordP;
    if (viagem.latitude && viagem.longitude) {
      coordP = Promise.resolve({ lat: viagem.latitude, lon: viagem.longitude });
    } else {
      var loc = viagem.localizacaoCurta || viagem.destinoPrincipal || viagem.destino || '';
      if (!loc) return Promise.resolve(null);
      coordP = _geocode(loc);
    }

    var _loc = viagem.localizacaoCurta || viagem.destinoPrincipal || viagem.destino || '';

    return coordP
      .then(function (coords) { return _fetchForecast(coords.lat, coords.lon); })
      .then(function (data) {
        if (_loc) data._loc = _loc;  // persiste cidade para links e validação
        _setCache(viagem.id, data);
        return data;
      })
      .catch(function (err) {
        console.warn('[WeatherService] Falha ao carregar:', err);
        return null;
      });
  }

  // ── Utilitários de data ───────────────────────────────────────────────────
  function _todayStr() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function _getDayData(data, dateStr) {
    if (!data || !data.daily) return null;
    for (var i = 0; i < data.daily.length; i++) {
      if (data.daily[i].date === dateStr) return data.daily[i];
    }
    return null;
  }

  // ── Renderizadores HTML ───────────────────────────────────────────────────

  // Pill compacto para o hero do dashboard: mostra clima atual + temperatura + link de previsão
  function renderHeroPill(data) {
    if (!data || !data.current) return '';
    var info    = _wmoInfo(data.current.code);
    var today   = _getDayData(data, _todayStr());
    var loc     = data._loc || '';
    // Use current temp; fallback to today's daily average if unavailable
    var temp    = (data.current.temp !== null && data.current.temp !== undefined)
      ? data.current.temp
      : (today ? Math.round((today.max + today.min) / 2) : '–');
    var range   = today
      ? '<span class="wb-hero-sep">·</span>' +
        '<span class="wb-hero-range">' + today.min + '° – ' + today.max + '°</span>'
      : '';
    var searchUrl = loc
      ? 'https://www.google.com/search?q=' + encodeURIComponent('previsão do tempo ' + loc) + '&hl=pt-BR'
      : 'https://www.google.com/search?q=previs%C3%A3o+do+tempo&hl=pt-BR';
    return (
      '<a class="wb-hero-pill" href="' + searchUrl + '" target="_blank" rel="noopener" title="Ver previsão completa para ' + (loc || 'destino') + '">' +
        '<span class="wb-hero-icon">' + info.icon + '</span>' +
        '<span class="wb-hero-temp">' + temp + '°C</span>' +
        range +
        '<span class="wb-hero-sep">·</span>' +
        '<span class="wb-hero-label">' + info.label + '</span>' +
        '<span class="wb-hero-ext">↗</span>' +
      '</a>'
    );
  }

  // Strip para o card da viagem: mostra os próximos 3 dias do intervalo da viagem
  function renderCardStrip(data, dataInicio, dataFim) {
    if (!data || !data.daily) return '';
    var today = _todayStr();
    // Take up to 3 days within trip dates that are in the forecast window
    var days = data.daily.filter(function (d) {
      return d.date >= today && (!dataInicio || d.date >= dataInicio) && (!dataFim || d.date <= dataFim);
    }).slice(0, 3);
    if (!days.length) {
      // If trip is in the future or past, show first 3 forecast days with available data
      days = data.daily.filter(function (d) {
        return (!dataInicio || d.date >= dataInicio) && (!dataFim || d.date <= dataFim);
      }).slice(0, 3);
    }
    if (!days.length) return '';
    var chips = days.map(function (d) {
      var info = _wmoInfo(d.code);
      var short = d.date.slice(5).replace('-', '/'); // MM/DD
      return (
        '<span class="wb-chip">' +
          '<span class="wb-chip-icon">' + info.icon + '</span>' +
          '<span class="wb-chip-date">' + short + '</span>' +
          '<span class="wb-chip-range">' + d.min + '°–' + d.max + '°</span>' +
        '</span>'
      );
    }).join('');
    return '<div class="wb-card-strip">' + chips + '</div>';
  }

  // Badge para o cabeçalho do dia no roteiro
  function renderDayBadge(data, dateStr) {
    if (!data || !dateStr) return '';
    var d = _getDayData(data, dateStr);
    if (!d) return '';
    var info = _wmoInfo(d.code);
    var rain = d.rainPct > 20
      ? '<span class="wb-badge-rain">💧' + d.rainPct + '%</span>'
      : '';
    return (
      '<span class="wb-day-badge">' +
        '<span class="wb-badge-icon">' + info.icon + '</span>' +
        '<span class="wb-badge-range">' + d.min + '°–' + d.max + '°</span>' +
        rain +
      '</span>'
    );
  }

  // ── atualizar (DOM update) ────────────────────────────────────────────────
  // Preenche todos os placeholders wb-* do tripId encontrados no DOM atual.
  function atualizar(tripId) {
    var data = _getCached(tripId);
    if (!data) return;

    // Hero pill
    var heroEl = document.getElementById('wb-hero-' + tripId);
    if (heroEl) {
      heroEl.innerHTML = renderHeroPill(data);
      heroEl.classList.remove('wb-loading');
    }

    // Trip card strips
    var cards = document.querySelectorAll('[data-wb-card="' + tripId + '"]');
    // Look up trip dates from Store if available
    var allViagens = (typeof Store !== 'undefined') ? Store.getViagens() : [];
    var v = allViagens.filter(function (x) { return x.id === tripId; })[0] || {};
    cards.forEach(function (el) {
      el.innerHTML = renderCardStrip(data, v.dataInicio, v.dataFim);
      el.classList.remove('wb-loading');
    });

    // Day badges in roteiro
    var dayEls = document.querySelectorAll('[data-wb-day^="' + tripId + '-"]');
    dayEls.forEach(function (el) {
      var dateStr = el.getAttribute('data-wb-day').slice(tripId.length + 1);
      el.innerHTML = renderDayBadge(data, dateStr);
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    precarregar:      precarregar,
    atualizar:        atualizar,
    getCached:        _getCached,
    renderHeroPill:   renderHeroPill,
    renderCardStrip:  renderCardStrip,
    renderDayBadge:   renderDayBadge,
    wmoInfo:          _wmoInfo,
  };

}());
