# azl-test-chat 💬

A real-time chat application built with **Next.js**, **Supabase**, and **OpenAI API**, designed for lightweight communication and extensibility.

---

## 🚀 Features

- 🔐 Authentication via Supabase
- 💬 Real-time chat with Supabase Realtime
- 🤖 AI assistant integration (OpenAI GPT)
- 🎨 Modern UI with Tailwind CSS
- 🌐 Deployed on [Vercel](https://azl-test-chat.vercel.app)

---

## 🧠 Tech Stack

- **Frontend**: Next.js (App Router), React, Tailwind CSS
- **Backend**: Supabase (Auth, Database, Realtime)
- **AI**: OpenAI GPT API
- **Deployment**: Vercel

---

## 📂 Project Structure

```
app/          # Next.js App Router pages and layouts
components/   # Reusable UI components
hooks/        # Custom React hooks
lib/          # API and utility functions
public/       # Static assets
scripts/      # Utility scripts
styles/       # Global styles and Tailwind config
```

---

## 🧪 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/RifqiAdli/azl-test-chat.git
cd azl-test-chat
```

### 2. Install Dependencies

```bash
npm install
# or
yarn
```

### 3. Set Up Environment Variables

Buat file `.env.local` dan isi seperti ini:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
OPENAI_API_KEY=your-openai-api-key
```

Atau salin dari `.env.example` jika tersedia.

### 4. Start the Development Server

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) di browser untuk melihat aplikasi.

---

## 🚀 Deployment

Project ini terhubung langsung ke Vercel dan akan otomatis ter-deploy setiap kali ada perubahan di branch `main`.

Deploy sendiri dengan tombol di bawah:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/import/project?template=https://github.com/RifqiAdli/azl-test-chat)


---

## 📄 License

MIT License © 2025 Rifqi Adli

---

## 🤝 Contributing

Pull request sangat disambut!  
Untuk perubahan besar, mohon buka *issue* terlebih dahulu untuk diskusi.
