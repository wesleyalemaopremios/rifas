"use strict";
const https = require("https");
const axios = require("axios");
const fs = require("fs");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

// Configurações do servidor
const app = express();
app.use(bodyParser.json());
app.use(cors());

// Caminho do certificado .p12
const certificado = fs.readFileSync("./homologacao-680504-loja2.p12");

// Credenciais do PIX
const credenciais = {
  client_id: "Client_Id_81ae6fbca0e6de8d8ce690690289bfd6e2e1d7bf",
  client_secret: "Client_Secret_57bd0d434850d5d8c578e01df13750a1a3ced239",
};

// Codificando as credenciais em base64
const auth = Buffer.from(`${credenciais.client_id}:${credenciais.client_secret}`).toString("base64");

// Função para obter o token de acesso
async function obterToken() {
  try {
    const agent = new https.Agent({
      pfx: certificado,
      passphrase: "", // Insira a senha do certificado, se necessário
    });

    const configToken = {
      method: "POST",
      url: "https://pix-h.api.efipay.com.br/oauth/token",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      httpsAgent: agent,
      data: JSON.stringify({ grant_type: "client_credentials" }),
    };

    const tokenResponse = await axios(configToken);
    console.log("Token de acesso recebido:", tokenResponse.data.access_token);
    return tokenResponse.data.access_token;
  } catch (error) {
    console.error("Erro ao obter token:", error.response ? error.response.data : error.message);
    throw new Error("Não foi possível obter o token de acesso.");
  }
}

// Função para gerar chave Pix
async function gerarChavePix(valor) {
  try {
    const token = await obterToken();
    const agent = new https.Agent({
      pfx: certificado,
      passphrase: "",
    });

    const configCob = {
      method: "POST",
      url: "https://pix-h.api.efipay.com.br/v2/cob",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      httpsAgent: agent,
      data: JSON.stringify({
        calendario: { expiracao: 3600 },
        valor: { original: valor.toFixed(2) },
        chave: "mtt.h10@hotmail.com", // Substitua pela sua chave Pix
        solicitacaoPagador: "Pagamento de títulos",
      }),
    };

    const cobResponse = await axios(configCob);
    console.log("Cobrança criada com sucesso:", cobResponse.data);

    // Baixar a imagem do QR Code
    const qrCodeUrl = cobResponse.data.loc.location;
    const qrCodeResponse = await axios.get(qrCodeUrl, { responseType: "arraybuffer" });
    const qrCodeBase64 = Buffer.from(qrCodeResponse.data, "binary").toString("base64");

    return {
      imagemQrcode: `data:image/png;base64,${qrCodeBase64}`, // QR Code em base64
      qrcode: cobResponse.data.pixCopiaECola, // Código copia e cola
    };
  } catch (error) {
    console.error("Erro ao gerar chave Pix:", error.response ? error.response.data : error.message);
    throw new Error("Não foi possível gerar a chave Pix.");
  }
}

// Rota para gerar a chave Pix
app.post("/gerar-chave-pix", async (req, res) => {
  try {
    const { valor } = req.body;
    console.log("Valor recebido para gerar chave Pix:", valor);

    const qrcodeData = await gerarChavePix(valor);
    res.json(qrcodeData);
  } catch (error) {
    console.error("Erro na rota /gerar-chave-pix:", error.message);
    res.status(500).json({ error: "Erro ao gerar chave Pix" });
  }
});

// Rota para verificar o pagamento
app.post("/verificar-pagamento", async (req, res) => {
  try {
    const { idPagamento } = req.body;
    const token = await obterToken();

    const configVerificarPagamento = {
      method: "GET",
      url: `https://pix-h.api.efipay.com.br/v2/pagamentos/${idPagamento}`,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    };

    const respostaPagamento = await axios(configVerificarPagamento);
    res.json({ status: respostaPagamento.data.status });
  } catch (error) {
    console.error("Erro na rota /verificar-pagamento:", error.message);
    res.status(500).json({ error: "Erro ao verificar pagamento" });
  }
});

// Iniciar o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
