import fetch from 'node-fetch';
import express from 'express';
import cors from 'cors';

const app = express();

// Middlewares para permitir a comunicação com o front-end
app.use(cors({ origin: true }));
app.use(express.json());

// Rota principal que recebe as solicitações da sua interface
app.post('/', async (request, response) => {
    // Validação da chave de API e dos dados recebidos
    const apiKey = request.headers.authorization;
    if (!apiKey || !apiKey.startsWith("Bearer ")) {
      return response.status(401).send({ error: { message: "Chave de API da Anthropic não fornecida no cabeçalho Authorization." } });
    }

    const { prompt, model } = request.body;
    if (!prompt || !model) {
      return response.status(400).send({ error: { message: "O 'prompt' e o 'model' são obrigatórios no corpo da requisição." } });
    }

    try {
        let fullContent = "";
        let stopReason = null;
        let messages = [{ role: "user", content: prompt }];
        let apiError = null;

        // Loop de continuação: pode fazer até 3 chamadas para garantir que o texto completo seja gerado.
        for (let i = 0; i < 3; i++) { 
            const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                    "x-api-key": apiKey.split("Bearer ")[1],
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                body: JSON.stringify({
                    model: model,
                    max_tokens: 4096, // Mantém um limite alto por chamada
                    messages: messages,
                }),
            });

            const data = await anthropicResponse.json();

            if (!anthropicResponse.ok) {
                console.error("Erro da API da Anthropic:", data);
                apiError = data; // Guarda o erro para retornar no final
                break; // Sai do loop em caso de erro
            }

            if (data.content && data.content.length > 0) {
                const partialContent = data.content[0].text;
                fullContent += partialContent; // Acumula o conteúdo gerado
                stopReason = data.stop_reason;

                // Se a IA terminou naturalmente, o trabalho está feito.
                if (stopReason !== 'max_tokens') {
                    break;
                }

                // Se o texto foi cortado, prepara a próxima chamada para continuar
                messages.push({ role: "assistant", content: fullContent });
                messages.push({ role: "user", content: "Please continue writing exactly where you left off. Do not repeat anything or add introductory phrases." });

            } else {
                // Se não houver conteúdo, para o processo.
                break;
            }
        }

        // Se ocorreu um erro durante as chamadas, retorna o erro.
        if (apiError) {
             return response.status(apiError.status || 500).send(apiError);
        }

        // Monta uma resposta final com o conteúdo completo, no mesmo formato que a interface espera.
        const finalResponse = {
            content: [{
                type: "text",
                text: fullContent
            }],
            model: model,
            stop_reason: stopReason,
        };

        return response.status(200).send(finalResponse);

    } catch (error) {
        console.error("Erro interno no servidor Cloud Run:", error);
        return response.status(500).send({ error: { message: "Ocorreu um erro interno no servidor." } });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Servidor escutando na porta ${PORT}`);
});

