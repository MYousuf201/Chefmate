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
      model: 'qwen/qwen3.6-27b',
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
  let content = data.choices?.[0]?.message?.content || '[]';
  content = content.replace(/<think>[\s\S]*?<\/think>/g, '');
  content = content.replace(/```json|```/g, '').trim();
  const jsonStart = content.indexOf('[');
  const jsonEnd = content.lastIndexOf(']');
  if (jsonStart !== -1 && jsonEnd !== -1) {
    content = content.substring(jsonStart, jsonEnd + 1);
  }
  return JSON.parse(content);
}
