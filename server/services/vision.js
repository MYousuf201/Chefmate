const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

export async function identifyIngredients(imageBase64) {
  const imageUrl = `data:image/jpeg;base64,${imageBase64}`;

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'List all visible food ingredients in this image as a JSON array of strings. Return ONLY valid JSON. No markdown, no explanation.' },
          { type: 'image_url', image_url: { url: imageUrl } }
        ]
      }]
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq error: ${response.status} ${err}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '[]';
  const cleaned = content.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned);
}
