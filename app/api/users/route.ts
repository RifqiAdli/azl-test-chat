import { getSupabaseClient } from "@/lib/supabase"

export async function GET() {
  try {
    const supabase = getSupabaseClient()

    const { data: users, error } = await supabase
      .from("chat_users")
      .select("*")
      .eq("is_online", true)
      .order("created_at", { ascending: true })

    if (error) throw error

    return Response.json({
      success: true,
      data: users,
      count: users?.length || 0,
    })
  } catch (error) {
    console.error("Error fetching users:", error)
    return Response.json(
      {
        success: false,
        error: "Failed to fetch users",
      },
      { status: 500 },
    )
  }
}
