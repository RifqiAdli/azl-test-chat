import { getSupabaseClient } from "@/lib/supabase"

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    console.log("API DELETE called for message:", params.id) // Debug log

    const supabase = getSupabaseClient()
    const messageId = params.id

    if (!messageId) {
      return Response.json({ error: "Message ID is required" }, { status: 400 })
    }

    // First check if message exists
    const { data: existingMessage, error: fetchError } = await supabase
      .from("messages")
      .select("id, user_name, content")
      .eq("id", messageId)
      .single()

    if (fetchError) {
      console.error("Error fetching message:", fetchError)
      return Response.json({ error: "Message not found" }, { status: 404 })
    }

    // Delete the message
    const { error: deleteError } = await supabase.from("messages").delete().eq("id", messageId)

    if (deleteError) {
      console.error("Error deleting message:", deleteError)
      throw deleteError
    }

    console.log("Message deleted successfully via API:", messageId)

    return Response.json({
      success: true,
      message: "Message deleted successfully",
      deleted_message: existingMessage,
    })
  } catch (error) {
    console.error("Error in DELETE API:", error)
    return Response.json(
      {
        success: false,
        error: error.message || "Failed to delete message",
      },
      { status: 500 },
    )
  }
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = getSupabaseClient()
    const messageId = params.id

    if (!messageId) {
      return Response.json({ error: "Message ID is required" }, { status: 400 })
    }

    const { data: message, error } = await supabase.from("messages").select("*").eq("id", messageId).single()

    if (error) {
      console.error("Error fetching message:", error)
      return Response.json({ error: "Message not found" }, { status: 404 })
    }

    return Response.json({
      success: true,
      data: message,
    })
  } catch (error) {
    console.error("Error fetching message:", error)
    return Response.json(
      {
        success: false,
        error: "Failed to fetch message",
      },
      { status: 500 },
    )
  }
}
