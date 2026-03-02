import { NextRequest, NextResponse } from "next/server";
import { TOOL_DECLARATIONS, executeTool } from "@/lib/iago-tools";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// ─── Model list: primary first, fallback second ───────────────────────────────
const GEMINI_MODELS = [
    "gemini-2.5-flash",  // primary — most capable
    "gemini-1.5-flash",  // fallback — if primary hits 429 quota
];

const geminiUrl = (model: string) =>
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

const SYSTEM_PROMPT = `Você é **Iago**, assistente financeiro do **Solux Finance OS**.
Data e hora atual: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}

## Personalidade
- Tom: amigável, próximo, como um controller de confiança do CEO
- Respostas curtas e diretas — nada de parágrafos longos
- Use emojis com moderação para deixar mais leve (✅ ⚠️ 💰 📊)
- Português do Brasil, linguagem acessível

## Como responder
- **Curto é melhor.** Se cabe em 3 linhas, não escreva 10.
- Destaque valores em **negrito**
- Use listas quando listar mais de 2 itens
- Riscos → ⚠️ | Oportunidades → ✅ | Valores → R$ XX.XXX,XX

## Regra de DATAS — MUITO IMPORTANTE
Quando o usuário mencionar um mês ou período sem especificar o ano:
- Sempre assuma o **ano mais próximo da data atual** (hoje é ${new Date().getFullYear()})
- Se a busca retornar 0 resultados, NÃO diga que não há dados. Em vez disso, pergunte: "Não encontrei lançamentos em [mês] de [ano]. Você se refere a outro período, como [mês] de [ano-1]?"
- Datas relativas: "esse mês" = mês atual, "mês passado" = mês anterior, "próximo mês" = mês seguinte
- NUNCA invente ou estime valores — sempre use as ferramentas para buscar dados reais

## Criação de lançamentos
Quando o usuário quiser criar um lançamento, peça APENAS:
1. **Nome/descrição** do lançamento
2. **Valor** (se vier negativo como -80, é automaticamente uma Saída)
3. **Data** (aceite "hoje", "amanhã", datas relativas)

Tipo (entrada/saída) você infere pelo contexto ou pelo sinal do valor. **Não peça campos extras** a não ser que o usuário queira detalhar.

Regras de inferência:
- Valor negativo (ex: -80) → **Saída**
- Palavras como "paguei", "gastei", "despesa" → **Saída**
- Palavras como "recebi", "venda", "cliente pagou" → **Entrada**
- Sem contexto claro → pergunte apenas: "É uma entrada ou saída?"

## Suas capacidades (use as ferramentas disponíveis)
- 📋 Listar e buscar lançamentos com qualquer filtro
- ➕ Criar lançamentos diretamente no sistema
- ✏️ Editar lançamentos existentes
- 🗑️ Deletar lançamentos (sempre confirme antes)
- 📊 Análise financeira: fluxo de caixa, saldo, inadimplência, tendências
- 💡 Análise de mercado: benchmarks do setor de construção civil, tendências macroeconômicas, inflação, CDI, câmbio
- 🔮 Projeções de saldo futuro com base nos lançamentos agendados
- ⚙️ Gestão tributária: INSS, ISS, IRPJ, DAS, Simples Nacional

## Contexto do sistema
- **Entradas**: receitas (serviços, vendas, adiantamentos)
- **Saídas**: despesas operacionais
- **[IMPOSTO]**: lançamentos tributários
- **Saldo Líquido**: Entradas − Saídas − Impostos
- Status: Pago | Atrasado | Cancelado | Agendado (planejado)

## Tom geral
Seja o melhor contador/analista que um CEO poderia ter: proativo, objetivo, sem enrolação. Use as ferramentas para buscar dados reais antes de responder — nunca invente números.`;

// ─── Gemini call helper (with model fallback on 429) ──────────────────────────
async function callGemini(body: object): Promise<{ response: Response; model: string }> {
    for (const model of GEMINI_MODELS) {
        const response = await fetch(geminiUrl(model), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        if (response.status !== 429 || model === GEMINI_MODELS[GEMINI_MODELS.length - 1]) {
            return { response, model };
        }
        // 429 and not the last model — try the next one
        console.warn(`[Iago] ${model} rate-limited, falling back to next model...`);
    }
    // Unreachable, but TypeScript needs it
    throw new Error("All Gemini models exhausted");
}

// ─── POST handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    try {
        if (!GEMINI_API_KEY) {
            return NextResponse.json({ error: "GEMINI_API_KEY não configurada" }, { status: 500 });
        }

        const { messages, context } = await req.json();

        // Build context string if provided (summary from the current page)
        let contextText = "";
        if (context) {
            contextText = `\n\n## Contexto atual da tela\n${JSON.stringify(context, null, 2)}`;
        }

        // Convert chat history to Gemini format
        const geminiMessages = messages.map((m: { role: string; content: string }) => ({
            role: m.role === "user" ? "user" : "model",
            parts: [{ text: m.content }],
        }));

        // ── Function calling loop (max 5 iterations to prevent infinite loops) ──
        let contents = [...geminiMessages];
        const MAX_TOOL_CALLS = 5;
        let toolCallCount = 0;
        let dataChanged = false;

        while (toolCallCount < MAX_TOOL_CALLS) {
            const body = {
                systemInstruction: {
                    role: "user",
                    parts: [{ text: SYSTEM_PROMPT + contextText }],
                },
                contents,
                tools: [{ function_declarations: TOOL_DECLARATIONS }],
                tool_config: { function_calling_config: { mode: "AUTO" } },
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 2048,
                    topP: 0.9,
                },
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
                ],
            };

            const { response, model: usedModel } = await callGemini(body);
            console.log(`[Iago] Using model: ${usedModel}`);

            if (!response.ok) {
                const errText = await response.text();
                console.error("Gemini API error:", errText);
                if (response.status === 429) {
                    return NextResponse.json({ error: "⚠️ Limite de requisições atingido em todos os modelos disponíveis. Tente novamente em alguns minutos.", quota: true }, { status: 429 });
                }
                return NextResponse.json({ error: "Erro na API Gemini: " + response.status }, { status: response.status });
            }

            const data = await response.json();
            const candidate = data.candidates?.[0];
            if (!candidate) break;

            const parts = candidate.content?.parts || [];

            // Check if there's a function call
            const functionCallPart = parts.find((p: any) => p.functionCall);
            if (functionCallPart) {
                toolCallCount++;
                const { name, args } = functionCallPart.functionCall;
                console.log(`[Iago] Calling tool: ${name}`, args);

                if (["create_transaction", "update_transaction", "delete_transaction"].includes(name)) {
                    dataChanged = true;
                }

                const toolResult = await executeTool(name, args || {});

                // Append model message with function call
                contents.push({
                    role: "model",
                    parts: [{ functionCall: { name, args: args || {} } }],
                });

                // Append function response
                contents.push({
                    role: "user",
                    parts: [{
                        functionResponse: {
                            name,
                            response: { content: toolResult },
                        },
                    }],
                });

                // Continue the loop to get the model's text response
                continue;
            }

            // No function call — extract text response
            const text = parts.find((p: any) => p.text)?.text
                || "Desculpe, não consegui processar sua solicitação. Tente novamente.";

            return NextResponse.json({ text, dataChanged });
        }

        return NextResponse.json({ text: "Não consegui completar a operação. Tente novamente.", dataChanged });
    } catch (error) {
        console.error("Iago API route error:", error);
        return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
    }
}
