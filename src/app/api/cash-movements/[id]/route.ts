import { NextResponse } from "next/server"
import { CashMovementService } from "@/services/cashMovementService"
import { requireAuthAndRole } from "@/lib/authUtils"
import { handleApiError } from "@/lib/errorHandler"