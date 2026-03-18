import { NextRequest, NextResponse } from "next/server";

const CAL_API_KEY = process.env.CAL_API_KEY!;
const CAL_EVENT_TYPE_ID = process.env.CAL_EVENT_TYPE_ID!;

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    start?: string;
    attendeeName?: string;
    attendeeEmail?: string;
  };

  const { start, attendeeName, attendeeEmail } = body;

  if (!start || !attendeeName || !attendeeEmail) {
    return NextResponse.json(
      { success: false, error: "Missing required fields: start, attendeeName, attendeeEmail" },
      { status: 400 }
    );
  }

  const res = await fetch("https://api.cal.com/v2/bookings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CAL_API_KEY}`,
      "cal-api-version": "2024-08-13",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      start,
      eventTypeId: Number(CAL_EVENT_TYPE_ID),
      attendee: {
        name: attendeeName,
        email: attendeeEmail,
        timeZone: "Europe/Berlin",
      },
    }),
  });

  if (!res.ok) {
    console.error("Cal.com booking error:", res.status, await res.text());
    return NextResponse.json(
      { success: false, error: "Could not book the slot. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: `Booking confirmed! ${attendeeName} will receive a confirmation at ${attendeeEmail}.`,
  });
}
