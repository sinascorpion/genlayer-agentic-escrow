import { NextResponse } from "next/server";

// In-memory global store across all clients & browsers connecting to the Vercel server
let globalEscrows: any[] = [];

export async function GET() {
  return NextResponse.json({ escrows: globalEscrows });
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    if (Array.isArray(data.escrows)) {
      globalEscrows = data.escrows;
    } else if (data.escrow) {
      // Upsert escrow
      const existingIdx = globalEscrows.findIndex((e) => e.id === data.escrow.id);
      if (existingIdx >= 0) {
        globalEscrows[existingIdx] = data.escrow;
      } else {
        globalEscrows.unshift(data.escrow);
      }
    }
    return NextResponse.json({ success: true, escrows: globalEscrows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
