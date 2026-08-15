// --- MAPEAMENTO DOS ELEMENTOS (DOM) ---
const alertaBox = document.getElementById('alerta-box');
const alertaTexto = document.getElementById('alerta-texto');
const statusIcone = document.querySelector('.status-icone');

const valorMercurio = document.getElementById('valor-mercurio');
const valorChumbo = document.getElementById('valor-chumbo');
const valorCadmio = document.getElementById('valor-cadmio');
const valorArsenio = document.getElementById('valor-arsenio');

const intensidadeFill = document.getElementById('intensidade-fill');
const intensidadeValorEl = document.getElementById('intensidade-valor');

const orientacaoPesca = document.getElementById('orientacao-pesca');
const orientacaoConsumidor = document.getElementById('orientacao-consumidor');

const btnVazamento = document.getElementById('btn-vazamento');
const btnReset = document.getElementById('btn-reset');
const btnDownload = document.getElementById('btn-download');

const timelineLista = document.getElementById('timeline-lista');

const detalhesPainel = document.getElementById('detalhes-ponto');
const detalhesNome = document.getElementById('detalhes-nome');
const detalhesFechar = document.getElementById('detalhes-fechar');
const detalhesMercurio = document.getElementById('detalhes-mercurio');
const detalhesChumbo = document.getElementById('detalhes-chumbo');
const detalhesCadmio = document.getElementById('detalhes-cadmio');
const detalhesArsenio = document.getElementById('detalhes-arsenio');
const detalhesStatus = document.getElementById('detalhes-status');

// --- CONFIGURAÇÃO DOS PONTOS DE MONITORAMENTO ---
// "distancia" representa a proximidade do foco de contaminação (sorteado a cada simulação)
const pontos = {
    ponte: {
        nome: 'Ponto 01 - Praia da Coroa',
        el: document.querySelector('#ponto-ponte .ponto-dot'),
        distancia: 0.25
    },
    porto: {
        nome: 'Ponto 02 - Praia do Cação',
        el: document.querySelector('#ponto-porto .ponto-dot'),
        distancia: 1.0
    },
    maranduba: {
        nome: 'Ponto 03 - Praia do Suape',
        el: document.querySelector('#ponto-maranduba .ponto-dot'),
        distancia: 0.7
    }
};

let modoVazamentoAtivo = false;
let intensidade = 0; // 0 = águas normais, 1 = contaminação máxima
const VELOCIDADE_RAMPA = 0.12; // controla o quão gradual é a subida/descida

// Sorteia qual ponto será o epicentro do vazamento a cada simulação,
// para que o risco não fique sempre concentrado no mesmo lugar.
function sortearEpicentro() {
    const fatores = [1.0, 0.7, 0.25]; // epicentro / atingido / mais distante
    const chaves = Object.keys(pontos);

    // embaralha os fatores (Fisher-Yates)
    for (let i = fatores.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [fatores[i], fatores[j]] = [fatores[j], fatores[i]];
    }

    chaves.forEach((chave, indice) => {
        pontos[chave].distancia = fatores[indice];
    });

    const epicentroChave = chaves.find((chave) => pontos[chave].distancia === 1.0);
    return pontos[epicentroChave].nome;
}
let pontoSelecionado = null;

// Limites CONAMA usados como referência
const LIMITES = { mercurio: 0.002, chumbo: 0.010, cadmio: 0.005, arsenio: 0.010 };

// Histórico para o gráfico e para o CSV
const historico = []; // { hora, mercurio, chumbo, cadmio }
const MAX_HISTORICO = 15; // 30 segundos a cada 2s

// --- GRÁFICO (SVG feito à mão — sem depender de bibliotecas externas) ---
const METAIS_GRAFICO = [
    { chave: 'mercurio', cor: '#118AB2', nome: 'Hg' },
    { chave: 'chumbo', cor: '#E8A33D', nome: 'Pb' },
    { chave: 'cadmio', cor: '#E63946', nome: 'Cd' },
    { chave: 'arsenio', cor: '#7B2CBF', nome: 'As' }
];

function desenharGrafico() {
    const wrap = document.getElementById('grafico-historico');
    if (!wrap) return; // essa página não tem gráfico

    if (historico.length < 2) {
        wrap.innerHTML = '<p class="grafico-vazio">Coletando leituras...</p>';
        return;
    }

    const largura = wrap.clientWidth || 300;
    const altura = wrap.clientHeight || 220;
    const pad = { top: 12, right: 12, bottom: 8, left: 12 };
    const larguraUtil = largura - pad.left - pad.right;
    const alturaUtil = altura - pad.top - pad.bottom;

    let maxValor = 0;
    historico.forEach((h) => METAIS_GRAFICO.forEach((m) => {
        if (h[m.chave] > maxValor) maxValor = h[m.chave];
    }));
    maxValor = maxValor * 1.2 || 0.01;

    const x = (i) => pad.left + (i / (historico.length - 1)) * larguraUtil;
    const y = (valor) => pad.top + alturaUtil - (valor / maxValor) * alturaUtil;

    let grade = '';
    for (let i = 0; i <= 3; i++) {
        const linhaY = pad.top + (alturaUtil / 3) * i;
        grade += `<line x1="${pad.left}" y1="${linhaY}" x2="${largura - pad.right}" y2="${linhaY}" stroke="rgba(7,59,76,0.08)" stroke-width="1" />`;
    }

    let linhas = '';
    METAIS_GRAFICO.forEach((m) => {
        const pontos = historico.map((h, i) => `${x(i).toFixed(1)},${y(h[m.chave]).toFixed(1)}`).join(' ');
        linhas += `<polyline points="${pontos}" fill="none" stroke="${m.cor}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />`;
    });

    wrap.innerHTML = `<svg viewBox="0 0 ${largura} ${altura}" width="100%" height="100%" preserveAspectRatio="none">${grade}${linhas}</svg>`;
}

// --- LINHA DO TEMPO ---
function registrarEvento(texto, tipo = 'info') {
    if (!timelineLista) return; // essa página não tem linha do tempo
    const li = document.createElement('li');
    li.className = `timeline-item timeline-${tipo}`;
    const hora = new Date().toLocaleTimeString('pt-BR');
    li.innerHTML = `<span class="timeline-hora">${hora}</span><span class="timeline-texto">${texto}</span>`;
    timelineLista.prepend(li);

    // mantém a lista com no máximo 12 itens
    while (timelineLista.children.length > 12) {
        timelineLista.removeChild(timelineLista.lastChild);
    }
}

// --- ALERTA DE DESPEJO: vibração + alarme sonoro ---
function tocarAlarme() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const duracaoTom = 0.18;
        const frequencias = [880, 660, 880, 660]; // bipe alternado tipo sirene
        frequencias.forEach((freq, indice) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';
            osc.frequency.value = freq;
            gain.gain.value = 0.15;
            osc.connect(gain);
            gain.connect(ctx.destination);
            const inicio = ctx.currentTime + indice * duracaoTom;
            osc.start(inicio);
            osc.stop(inicio + duracaoTom);
        });
    } catch (erro) {
        console.warn('BlueGuard: não foi possível tocar o alarme sonoro ->', erro.message);
    }
}

function vibrarDispositivo() {
    if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200, 100, 400]);
    }
}

// --- BOTÕES DE EVENTO ---
if (btnVazamento) {
    btnVazamento.addEventListener('click', () => {
        if (modoVazamentoAtivo) return;
        modoVazamentoAtivo = true;
        const nomeEpicentro = sortearEpicentro();
        registrarEvento(`Despejo irregular simulado próximo a ${nomeEpicentro}. Concentrações começando a subir.`, 'perigo');
        vibrarDispositivo();
        tocarAlarme();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

if (btnReset) {
    btnReset.addEventListener('click', () => {
        if (!modoVazamentoAtivo) return;
        modoVazamentoAtivo = false;
        registrarEvento('Ação de normalização iniciada. Concentrações voltando aos níveis seguros.', 'seguro');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

if (btnDownload) {
    btnDownload.addEventListener('click', baixarRelatorioCSV);
}

if (detalhesFechar) {
    detalhesFechar.addEventListener('click', () => {
        pontoSelecionado = null;
        detalhesPainel.classList.add('detalhes-oculto');
    });
}

if (detalhesPainel) {
    Object.keys(pontos).forEach((chave) => {
        const container = document.getElementById(
            chave === 'ponte' ? 'ponto-ponte' : chave === 'porto' ? 'ponto-porto' : 'ponto-maranduba'
        );
        if (!container) return;
        const selecionar = () => {
            pontoSelecionado = chave;
            detalhesPainel.classList.remove('detalhes-oculto');
            atualizarDetalhesPonto();
        };
        container.addEventListener('click', selecionar);
        container.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selecionar(); }
        });
    });
}

// --- CÁLCULO DE VALORES ---
function gerarValor(base, faixa) {
    return base + Math.random() * faixa;
}

function calcularValoresPonto(distanciaFator) {
    const nivel = intensidade * distanciaFator;
    return {
        mercurio: gerarValor(0.0004, 0.0006) + nivel * gerarValor(0.0038, 0.0022),
        chumbo: gerarValor(0.0035, 0.0020) + nivel * gerarValor(0.0135, 0.0100),
        cadmio: gerarValor(0.0009, 0.0011) + nivel * gerarValor(0.0058, 0.0032),
        arsenio: gerarValor(0.0007, 0.0009) + nivel * gerarValor(0.0100, 0.0075)
    };
}

function statusDoPonto(valores) {
    if (valores.mercurio > LIMITES.mercurio || valores.chumbo > LIMITES.chumbo || valores.cadmio > LIMITES.cadmio || valores.arsenio > LIMITES.arsenio) {
        return 'perigo';
    }
    return 'seguro';
}

function nomesPontosEmRisco() {
    const emRisco = Object.values(pontos)
        .filter((ponto) => statusDoPonto(calcularValoresPonto(ponto.distancia)) === 'perigo')
        .map((ponto) => ponto.nome.replace(/^Ponto \d+ - /, ''));

    if (emRisco.length === 0) return 'nenhum ponto no momento';
    if (emRisco.length === 1) return emRisco[0];
    return `${emRisco.slice(0, -1).join(', ')} e ${emRisco[emRisco.length - 1]}`;
}

function atualizarDetalhesPonto() {
    if (!pontoSelecionado) return;
    const ponto = pontos[pontoSelecionado];
    const valores = calcularValoresPonto(ponto.distancia);
    const status = statusDoPonto(valores);

    detalhesNome.innerText = ponto.nome;
    detalhesMercurio.innerText = `${valores.mercurio.toFixed(4)} mg/L`;
    detalhesChumbo.innerText = `${valores.chumbo.toFixed(4)} mg/L`;
    detalhesCadmio.innerText = `${valores.cadmio.toFixed(4)} mg/L`;
    detalhesArsenio.innerText = `${valores.arsenio.toFixed(4)} mg/L`;
    detalhesStatus.innerText = status === 'perigo'
        ? '⚠️ Concentrações acima do limite CONAMA neste ponto.'
        : '✅ Concentrações dentro dos limites CONAMA neste ponto.';
    detalhesStatus.style.color = status === 'perigo' ? '#E63946' : '#2FA84F';
}

// Atualiza as mensagens de orientação — usada tanto pelo Painel (calculando ao
// vivo) quanto pela página Comunidade (lendo o último status salvo).
function aplicarOrientacao(emRisco, locais) {
    if (!orientacaoPesca || !orientacaoConsumidor) return;
    if (!emRisco) {
        orientacaoPesca.innerText = 'Navegação e coleta liberadas em toda a região costeira. Qualidade excelente do pescado.';
        orientacaoPesca.style.color = '';
        orientacaoConsumidor.innerText = 'Frutos do mar e peixes locais testados e 100% seguros para consumo e comércio regional.';
        orientacaoConsumidor.style.color = '';
    } else {
        orientacaoPesca.innerHTML = `⚠️ <strong>ATENÇÃO MARISQUEIRAS:</strong> Coleta proibida nas proximidades de ${locais}. Afaste-se das áreas em vermelho.`;
        orientacaoPesca.style.color = '#E63946';
        orientacaoConsumidor.innerHTML = `⚠️ <strong>ALERTA AO CONSUMIDOR:</strong> Evite o consumo de moluscos e bivalves coletados nesta data em ${locais} devido ao risco de contaminação química.`;
        orientacaoConsumidor.style.color = '#E63946';
    }
}

// --- MOTOR PRINCIPAL DO SIMULADOR (só roda na página do Painel) ---
function gerenciarSimulador() {
    if (!alertaBox) return; // essa página não é o painel de simulação

    // Suaviza a intensidade em direção ao alvo (0 ou 1) -> transição gradual, não instantânea
    const alvo = modoVazamentoAtivo ? 1 : 0;
    const intensidadeAnterior = intensidade;
    intensidade += (alvo - intensidade) * VELOCIDADE_RAMPA;
    if (Math.abs(alvo - intensidade) < 0.01) intensidade = alvo;
    intensidade = Math.max(0, Math.min(1, intensidade));

    // Marcos da linha do tempo baseados na intensidade
    if (intensidadeAnterior < 0.5 && intensidade >= 0.5 && modoVazamentoAtivo) {
        registrarEvento(`Contaminação atingiu 50% de intensidade. Risco crescente em ${nomesPontosEmRisco()}.`, 'perigo');
    }
    if (intensidadeAnterior < 0.95 && intensidade >= 0.95 && modoVazamentoAtivo) {
        registrarEvento('Pico de contaminação atingido. Atividade pesqueira deve ser suspensa nas zonas de risco.', 'perigo');
    }
    if (intensidadeAnterior > 0.05 && intensidade <= 0.05 && !modoVazamentoAtivo) {
        registrarEvento('Sistema normalizado. Águas novamente próprias para pesca e mariscagem.', 'seguro');
    }

    // Valores gerais (usados no painel principal) = leitura combinada dos pontos
    const geral = calcularValoresPonto(0.65);

    const emRisco = intensidade > 0.3;

    // Alerta principal
    if (!emRisco) {
        alertaBox.className = 'alerta-seguro';
        statusIcone.innerText = '🟢';
        alertaTexto.innerText = 'SISTEMA OPERACIONAL: ÁGUAS PRÓPRIAS PARA PESCA E MARISCAGEM';
    } else {
        alertaBox.className = 'alerta-perigo';
        statusIcone.innerText = '🚨';
        alertaTexto.innerHTML = 'ALERTA CRÍTICO: ALTA CONCENTRAÇÃO DE METAIS PESADOS! <br> Evitar a atividade pesqueira nas zonas indicadas.';
    }

    // Barra de intensidade
    const percentual = Math.round(intensidade * 100);
    intensidadeFill.style.width = `${percentual}%`;
    intensidadeFill.className = 'intensidade-fill' + (emRisco ? ' intensidade-perigo' : '');
    intensidadeValorEl.innerText = `${percentual}%`;

    // Atualiza o mapa de risco (cada ponto reage de acordo com sua distância do foco)
    Object.values(pontos).forEach((ponto) => {
        const valoresPonto = calcularValoresPonto(ponto.distancia);
        const status = statusDoPonto(valoresPonto);
        ponto.el.className = `ponto-dot ${status}`;
    });

    // Mensagens de orientação prática (a função também é usada pela página Comunidade)
    aplicarOrientacao(emRisco, nomesPontosEmRisco());
    if (!emRisco) {
        valorMercurio.style.color = ''; valorChumbo.style.color = ''; valorCadmio.style.color = ''; valorArsenio.style.color = '';
    } else {
        valorMercurio.style.color = '#E63946'; valorChumbo.style.color = '#E63946'; valorCadmio.style.color = '#E63946'; valorArsenio.style.color = '#E63946';
    }

    // Exibe os valores gerais
    valorMercurio.innerText = `${geral.mercurio.toFixed(4)} mg/L ${emRisco ? '⚠️' : ''}`;
    valorChumbo.innerText = `${geral.chumbo.toFixed(4)} mg/L ${emRisco ? '⚠️' : ''}`;
    valorCadmio.innerText = `${geral.cadmio.toFixed(4)} mg/L ${emRisco ? '⚠️' : ''}`;
    valorArsenio.innerText = `${geral.arsenio.toFixed(4)} mg/L ${emRisco ? '⚠️' : ''}`;

    // Atualiza detalhes do ponto selecionado, se houver
    atualizarDetalhesPonto();

    // Registra no histórico + atualiza gráfico
    const horaAtual = new Date().toLocaleTimeString('pt-BR');
    historico.push({ hora: horaAtual, ...geral });
    if (historico.length > MAX_HISTORICO) historico.shift();

    desenharGrafico();

    // Salva um "retrato" do status atual — a página Comunidade lê isso pra
    // manter a Orientação e a exportação de dados sincronizadas.
    try {
        localStorage.setItem('blueguard_status', JSON.stringify({ emRisco, locais: nomesPontosEmRisco() }));
        localStorage.setItem('blueguard_historico_export', JSON.stringify(historico));
    } catch (erro) {
        console.warn('BlueGuard: não foi possível sincronizar o status ->', erro.message);
    }
}

// --- SINCRONIZAÇÃO PARA A PÁGINA COMUNIDADE ---
// Essa página não roda a simulação — ela só lê o último status salvo pelo
// Painel (via localStorage) e atualiza a Orientação de tempos em tempos.
function sincronizarComunidade() {
    if (!orientacaoPesca || alertaBox) return; // só faz sentido na página Comunidade
    try {
        const salvo = localStorage.getItem('blueguard_status');
        if (salvo) {
            const status = JSON.parse(salvo);
            aplicarOrientacao(status.emRisco, status.locais);
        }
    } catch (erro) {
        console.warn('BlueGuard: não foi possível ler o status salvo ->', erro.message);
    }
}
sincronizarComunidade();
setInterval(sincronizarComunidade, 2000);

// --- EXPORTAÇÃO DE DADOS (CSV real) ---
function baixarRelatorioCSV() {
    let dados = historico;

    // Na página Comunidade a simulação não roda ao vivo — usa o último
    // histórico que o Painel salvou no localStorage.
    if (dados.length === 0) {
        try {
            const salvo = localStorage.getItem('blueguard_historico_export');
            if (salvo) dados = JSON.parse(salvo);
        } catch (erro) {
            console.warn('BlueGuard: não foi possível ler o histórico salvo ->', erro.message);
        }
    }

    if (dados.length === 0) {
        const textoOriginal = btnDownload.innerText;
        btnDownload.innerText = '⚠️ Abra o Painel primeiro';
        setTimeout(() => { btnDownload.innerText = textoOriginal; }, 2200);
        return;
    }

    const linhas = [
        'timestamp,mercurio_mgL,chumbo_mgL,cadmio_mgL,arsenio_mgL,limite_mercurio,limite_chumbo,limite_cadmio,limite_arsenio,status'
    ];

    dados.forEach((registro) => {
        const status = (registro.mercurio > LIMITES.mercurio || registro.chumbo > LIMITES.chumbo || registro.cadmio > LIMITES.cadmio || registro.arsenio > LIMITES.arsenio)
            ? 'CONTAMINADO'
            : 'NORMAL';
        linhas.push([
            registro.hora,
            registro.mercurio.toFixed(4),
            registro.chumbo.toFixed(4),
            registro.cadmio.toFixed(4),
            registro.arsenio.toFixed(4),
            LIMITES.mercurio,
            LIMITES.chumbo,
            LIMITES.cadmio,
            LIMITES.arsenio,
            status
        ].join(','));
    });

    const csvConteudo = linhas.join('\n');
    const blob = new Blob([csvConteudo], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio_ambiental_madre_de_deus_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    registrarEvento('Relatório técnico (.CSV) exportado com sucesso para envio a órgãos ambientais.', 'info');
}

// --- CANAL DE DENÚNCIA CIDADÃ ---
const formDenuncia = document.getElementById('form-denuncia');
const inputFoto = document.getElementById('foto-denuncia');
const previewFoto = document.getElementById('preview-foto');
const uploadTexto = document.getElementById('upload-texto');
const selectLocal = document.getElementById('local-denuncia');
const textareaDescricao = document.getElementById('descricao-denuncia');
const listaDenuncias = document.getElementById('lista-denuncias');
const semDenuncias = document.getElementById('sem-denuncias');

const CHAVE_STORAGE = 'blueguard_denuncias';
let fotoAtualBase64 = null;

function carregarDenuncias() {
    try {
        const salvo = localStorage.getItem(CHAVE_STORAGE);
        return salvo ? JSON.parse(salvo) : [];
    } catch (erro) {
        console.warn('BlueGuard: não foi possível ler denúncias salvas ->', erro.message);
        return [];
    }
}

function salvarDenuncias() {
    try {
        localStorage.setItem(CHAVE_STORAGE, JSON.stringify(denuncias));
    } catch (erro) {
        console.warn('BlueGuard: não foi possível salvar a denúncia neste navegador ->', erro.message);
    }
}

let denuncias = carregarDenuncias();

function escaparHtml(texto) {
    const div = document.createElement('div');
    div.innerText = texto;
    return div.innerHTML;
}

function renderizarDenuncias() {
    if (!listaDenuncias) return; // essa página não tem o canal de denúncia
    listaDenuncias.querySelectorAll('.denuncia-item').forEach((el) => el.remove());

    if (denuncias.length === 0) {
        semDenuncias.style.display = 'block';
        return;
    }
    semDenuncias.style.display = 'none';

    denuncias.forEach((d, indice) => {
        const item = document.createElement('div');
        item.className = 'denuncia-item';
        item.innerHTML = `
            ${d.foto ? `<img class="denuncia-foto" src="${d.foto}" alt="Foto enviada na denúncia">` : ''}
            <div class="denuncia-corpo">
                <div class="denuncia-topo">
                    <span class="denuncia-local">📍 ${escaparHtml(d.local)}</span>
                    <span class="denuncia-hora">${escaparHtml(d.hora)}</span>
                </div>
                <p class="denuncia-texto">${escaparHtml(d.texto)}</p>
                <button type="button" class="denuncia-remover" data-indice="${indice}">Remover</button>
            </div>
        `;
        listaDenuncias.appendChild(item);
    });

    listaDenuncias.querySelectorAll('.denuncia-remover').forEach((botao) => {
        botao.addEventListener('click', () => {
            const indice = Number(botao.dataset.indice);
            denuncias.splice(indice, 1);
            salvarDenuncias();
            renderizarDenuncias();
        });
    });
}

if (inputFoto) {
    inputFoto.addEventListener('change', () => {
        const arquivo = inputFoto.files[0];
        if (!arquivo) return;

        const leitor = new FileReader();
        leitor.onload = () => {
            fotoAtualBase64 = leitor.result;
            previewFoto.src = fotoAtualBase64;
            previewFoto.style.display = 'block';
            uploadTexto.innerText = '✅ Foto selecionada — clique para trocar';
        };
        leitor.readAsDataURL(arquivo);
    });
}

if (formDenuncia) {
    formDenuncia.addEventListener('submit', (e) => {
        e.preventDefault();

        const novaDenuncia = {
            local: selectLocal.value,
            texto: textareaDescricao.value.trim(),
            foto: fotoAtualBase64,
            hora: new Date().toLocaleString('pt-BR')
        };

        denuncias.unshift(novaDenuncia);
        salvarDenuncias();
        renderizarDenuncias();
        registrarEvento(`Nova denúncia cidadã recebida — ${novaDenuncia.local}.`, 'info');

        // reseta o formulário
        formDenuncia.reset();
        fotoAtualBase64 = null;
        previewFoto.style.display = 'none';
        previewFoto.src = '';
        uploadTexto.innerText = '📷 Clique para enviar uma foto';
    });
}

renderizarDenuncias();

// ATUALIZAÇÃO A CADA 2 SEGUNDOS
setInterval(gerenciarSimulador, 2000);

// Inicia o site rodando
gerenciarSimulador();