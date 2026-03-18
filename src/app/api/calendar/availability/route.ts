import { NextResponse } from "next/server";

const CAL_API_KEY = process.env.CAL_API_KEY!;
const CAL_USERNAME = process.env.CAL_USERNAME!;
const CAL_EVENT_TYPE_ID = process.env.CAL_EVENT_TYPE_ID!;

export async function GET() {
  const now = new Date();
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    username: CAL_USERNAME,
    eventTypeId: CAL_EVENT_TYPE_ID,
    startTime: now.toISOString(),
    endTime: sevenDaysLater.toISOString(),
  });

  const res = await fetch(
    `https://api.cal.com/v2/slots/available?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${CAL_API_KEY}`,
        "cal-api-version": "2024-08-13",
      },
    }
  );

  if (!res.ok) {
    return NextResponse.json(
      { slotsText: "No available slots in the next 7 days.", slots: [] }
    );
  }

  const data = await res.json();
  const slotsObj: Record<string, { time: string }[]> = data?.data?.slots ?? data?.slots ?? {};

  type SlotEntry = { start: string; display: string };
  const result: SlotEntry[] = [];
  let daysCollected = 0;

  for (const [, daySlots] of Object.entries(slotsObj)) {
    if (daysCollected >= 3) break;
    const dayEntries = daySlots.slice(0, 3);
    for (const slot of dayEntries) {
      const date = new Date(slot.time);
      const display = date.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      result.push({ start: slot.time, display });
    }
    daysCollected++;
  }

  if (result.length === 0) {
    return NextResponse.json({
      slotsText: "No available slots in the next 7 days.",
      slots: [],
    });
  }

  const slotsText =
    "Available slots:\n" + result.map((s) => `- ${s.display}`).join("\n");

  return NextResponse.json({ slotsText, slots: result });
}
