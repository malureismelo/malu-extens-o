export async function generateMessage(apiKey, project) {
  const prompt = `
Você é um especialista em propostas freelance.

Crie uma mensagem curta, natural e personalizada para este projeto:

Título: ${project.title}
Descrição: ${project.description}

A mensagem deve:
- ser humana
- não parecer spam
- mostrar experiência similar
- terminar pedindo conversa

Use este modelo como base:

Olá! Tudo bem?

Já desenvolvi projetos semelhantes ao seu.

Tenho experiência com soluções como a sua descrição.

Tenho interesse em participar do projeto.

Podemos conversar melhor sobre ele?
`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7
    })
  });

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}