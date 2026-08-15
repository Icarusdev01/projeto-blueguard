import random
from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
# O CORS permite que o seu site (HTML/JS) converse com o servidor Python com segurança
CORS(app)

# Estado inicial do nosso simulador ambiental
status_sistema = {
    "vazamento_ativo": False,
    "mensagens": {
        "seguro": "SISTEMA OPERACIONAL: ÁGUAS PRÓPRIAS PARA PESCA E MARISCAGEM",
        "perigo": "ALERTA CRÍTICO: ALTA CONCENTRAÇÃO DE METAIS PESADOS! Setor interditado por ordem do órgão ambiental."
    }
}

@app.route('/api/sensores', methods=['GET'])
def obter_dados_sensores():
    """
    Esta rota simula a leitura dos sensores em tempo real na costa de Madre de Deus.
    O JavaScript vai consultar essa função a cada 3 segundos.
    """
    
    # Se o modo de vazamento NÃO estiver ativo, geramos valores baixos e seguros
    if not status_sistema["vazamento_ativo"]:
        mercurio = round(random.uniform(0.0005, 0.0015), 4)
        chumbo = round(random.uniform(0.0030, 0.0060), 4)
        cadmio = round(random.uniform(0.0008, 0.0020), 4)
        status_geral = "SEGURO"
        mensagem = status_sistema["mensagens"]["seguro"]
    
    # Se houver um vazamento ativo, os valores disparam acima do limite legal (IA/Regra de Negócio)
    else:
        mercurio = round(random.uniform(0.0045, 0.0080), 4)
        chumbo = round(random.uniform(0.0150, 0.0350), 4)
        cadmio = round(random.uniform(0.0060, 0.0110), 4)
        status_geral = "PERIGO"
        mensagem = status_sistema["mensagens"]["perigo"]

    # --- Lógica de IA Simplificada (Tomada de Decisão Automatizada) ---
    # O próprio servidor analisa os dados antes de enviar para a plataforma
    if mercurio > 0.002 or chumbo > 0.010 or cadmio > 0.005:
        status_geral = "PERIGO"
        mensagem = status_sistema["mensagens"]["perigo"]

    # Retorna os dados organizados em formato JSON (padrão de mercado para APIs)
    return jsonify({
        "status": status_geral,
        "mensagem": message_formatada(mensagem, status_geral),
        "metais": {
            "mercurio": f"{mercurio} mg/L",
            "chumbo": f"{chumbo} mg/L",
            "cadmio": f"{cadmio} mg/L"
        }
    })

def message_formatada(msg, status):
    icone = "🚨" if status == "PERIGO" else "🟢"
    return f"{icone} {msg}"

# Rotas para controlar o simulador via backend se necessário
@app.route('/api/simular/vazamento', methods=['POST'])
def ativar_vazamento():
    status_sistema["vazamento_ativo"] = True
    return jsonify({"resultado": "Vazamento simulado ativado no servidor"})

@app.route('/api/simular/normalizar', methods=['POST'])
def desativar_vazamento():
    status_sistema["vazamento_ativo"] = False
    return jsonify({"resultado": "Sistema normalizado no servidor"})

if __name__ == '__main__':
    # Roda o servidor na porta padrão 5000
    app.run(debug=True, port=5000)