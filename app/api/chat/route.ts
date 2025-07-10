import { openai } from "@ai-sdk/openai"
import { generateText } from "ai"

export async function POST(req: Request) {
  try {
    const { message, action } = await req.json()

    if (action === "moderate") {
      // Check apakah pesannya ada kata kotor ap g
      const { text } = await generateText({
        model: openai("gpt-4o"),
        prompt: `Analisis pesan ini untuk konten toxic, spam, atau bahasa kasar dalam Bahasa Indonesia dan Inggris. 
  
  Deteksi:
  - Kata-kata kasar/umpatan Indonesia (anjing, babi, bangsat, kontol, memek, tai, sial, dll)
  - Kata-kata kasar Inggris 
  - SPAM (pesan berulang, all caps berlebihan)
  - Ujaran kebencian atau bullying
  - Konten seksual atau tidak pantas
  - Ancaman atau kekerasan
  
  Jawab hanya "TOXIC" jika mengandung konten berbahaya.
  Jawab hanya "CLEAN" jika pesan pantas untuk chat room ramah.
  
  Pesan: "${message}"`,
        maxTokens: 10,
      })

      const isToxic = text.trim().toUpperCase().includes("TOXIC")

      return Response.json({
        isToxic,
        message: isToxic ? "Message contains inappropriate content" : "Message is clean",
      })
    }

    return Response.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("Moderation error:", error)
    return Response.json({ error: "Moderation failed" }, { status: 500 })
  }
}
