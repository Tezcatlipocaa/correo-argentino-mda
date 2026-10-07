param(
    [string]$ExcelPath = "C:\Users\daaltamirano1\Downloads\MDA - Gestión de Desempeño - Septiembre 2026 - Copia.xlsx",
    [string]$OutputPath = "scripts/data/calidad-septiembre-2026.json"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $ExcelPath)) {
    $found = (Get-ChildItem -Path (Split-Path $ExcelPath -Parent) -Filter "*MDA*Septiembre*.xlsx" -ErrorAction SilentlyContinue | Select-Object -First 1)
    if ($found) {
        $ExcelPath = $found.FullName
    } else {
        Write-Error "No se encontró el archivo Excel en: $ExcelPath"
        exit 1
    }
}

$outputDir = Split-Path $OutputPath -Parent
if ($outputDir -and -not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

Write-Host "Abriendo Excel COM..."
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

function ParseBoolVal($v) {
    if ($null -eq $v) { return $false }
    $s = "$v".Trim().ToUpper()
    if ($s -eq "TRUE" -or $s -eq "SI" -or $s -eq "VERDADERO" -or $s -eq "1") { return $true }
    return $false
}

function CleanStr($v) {
    if ($null -eq $v) { return "" }
    $s = "$v".Trim()
    if ($s -eq "·") { return "" }
    return $s
}

function FormatExcelTime($v) {
    if ($null -eq $v) { return "00:00:00" }
    $str = "$v".Trim()
    if ($str -match "^\d{1,2}:\d{2}(:\d{2})?$") {
        if ($str -match "^\d{1,2}:\d{2}$") { return "$str:00" }
        return $str
    }
    # Si viene como número OADate (fracción de día)
    if ($v -is [double] -or $v -is [float] -or $str -match "^\d+(\.\d+)?$") {
        try {
            $num = [double]$str
            $span = [TimeSpan]::FromDays($num)
            $totalHours = [int][Math]::Floor($span.TotalHours)
            $mins = $span.Minutes.ToString("00")
            $secs = $span.Seconds.ToString("00")
            return "$($totalHours.ToString('00')):${mins}:${secs}"
        } catch {
            return "00:00:00"
        }
    }
    return "00:00:00"
}

function FormatExcelDate($v, $defaultDate) {
    if ($null -eq $v -or "$v".Trim() -eq "" -or "$v".Trim() -eq "Fecha" -or "$v".Trim() -eq "·") {
        return $defaultDate
    }
    $str = "$v".Trim().ToLower()
    
    # Número serial Excel (ej 46268)
    if ($str -match "^\d{5}$") {
        try {
            $dt = [DateTime]::FromOADate([double]$str)
            return $dt.ToString("yyyy-MM-dd")
        } catch {}
    }

    # Formatos texto tipo "1-sep.", "01 sep.", "8-Sep", "26-Aug", "4-ago"
    if ($str -match "(\d{1,2})[-/\s]+([a-z]{3,4})") {
        $day = [int]$matches[1]
        $monthStr = $matches[2]
        $month = 9
        if ($monthStr -like "*ago*" -or $monthStr -like "*aug*") {
            $month = 8
        } elseif ($monthStr -like "*sep*") {
            $month = 9
        } elseif ($monthStr -like "*oct*") {
            $month = 10
        }
        $dayStr = $day.ToString("00")
        $monthFormatted = $month.ToString("00")
        return "2026-$monthFormatted-$dayStr"
    }

    return $defaultDate
}

function ParsePercent($v) {
    if ($null -eq $v) { return 0 }
    $s = "$v".Trim().Replace("%", "").Replace(",", ".")
    try {
        $val = [double]$s
        if ($val -le 1.0 -and $val -gt 0) {
            return [int][Math]::Round($val * 100)
        }
        return [int][Math]::Round($val)
    } catch {
        return 0
    }
}

$allAudits = @()

try {
    $wb = $excel.Workbooks.Open($ExcelPath, $false, $true)

    foreach ($ws in $wb.Sheets) {
        $sheetName = $ws.Name
        if ($sheetName -like "*Promedio*" -or $sheetName -like "*LLamados*" -or $sheetName -like "*Mails*" -or $sheetName -like "*Autogestiones*") {
            continue
        }

        Write-Host "Procesando $sheetName..."
        $arr = $ws.UsedRange.Value2
        
        # Fallback dates per sample index
        $fallbackDates = @("2026-09-01", "2026-09-08", "2026-09-15", "2026-09-22")

        # 1. CANAL: WISE_CALL (Llamados)
        $callBases = @(0, 16, 32, 48)
        for ($sIdx = 0; $sIdx -lt 4; $sIdx++) {
            $b = $callBases[$sIdx]
            $callId = CleanStr($arr[($b + 2), 2])
            if ($callId -ne "") {
                $ring = FormatExcelTime $arr[($b + 2), 3]
                $dur = FormatExcelTime $arr[($b + 2), 4]
                
                # Intentar leer fecha en fila 4 o fila 3
                $rawDate = CleanStr($arr[($b + 4), 1])
                if ($rawDate -eq "" -or $rawDate -eq "Fecha") {
                    $rawDate = CleanStr($arr[($b + 3), 1])
                }
                $date = FormatExcelDate $rawDate $fallbackDates[$sIdx]

                # Solicitud / Ticket
                $solicitudOk = ParseBoolVal $arr[($b + 12), 8]
                $rawTicket = CleanStr($arr[($b + 12), 9])
                $ticketId = $rawTicket
                if ($ticketId -eq "" -or -not $solicitudOk) {
                    if ($ticketId -eq "") { $ticketId = "N/A" }
                }

                $appliesMda = $solicitudOk

                # Scores Items (Sección 1)
                $scores = @()
                $callItemCodes = @(
                    "call_cordialidad",
                    "call_saludo_estandar",
                    "call_interes_resolver",
                    "call_sondeo",
                    "call_escucha_activa",
                    "call_control_conversacion",
                    "call_contencion_espera",
                    "call_despedida_cordial",
                    "call_lenguaje_apropiado",
                    "call_procedimiento"
                )
                for ($k = 0; $k -lt $callItemCodes.Count; $k++) {
                    $r = $b + 2 + $k
                    $code = $callItemCodes[$k]
                    $val = ParseBoolVal $arr[$r, 8]
                    $comm = CleanStr $arr[$r, 9]
                    $scores += [PSCustomObject]@{
                        code = $code
                        score = $val
                        comment = if ($comm -ne "") { $comm } else { $null }
                    }
                }

                # Scores Ticket (Sección 2)
                $callTicketCodes = @(
                    "call_ticket_origen",
                    "call_ticket_tipo",
                    "call_ticket_categorizacion",
                    "call_ticket_ortografia",
                    "call_ticket_prioridad",
                    "call_ticket_titulo",
                    "call_ticket_descripcion",
                    "call_ticket_exactitud_datos",
                    "call_ticket_reclamo_novedad"
                )
                for ($k = 0; $k -lt $callTicketCodes.Count; $k++) {
                    $r = $b + 2 + $k
                    $code = $callTicketCodes[$k]
                    $val = ParseBoolVal $arr[$r, 13]
                    $comm = CleanStr $arr[$r, 14]
                    $scores += [PSCustomObject]@{
                        code = $code
                        score = $val
                        comment = if ($comm -ne "") { $comm } else { $null }
                    }
                }

                $s1Score = ParsePercent $arr[($b + 15), 7]
                $s2Score = ParsePercent $arr[($b + 15), 9]
                $totalScore = ParsePercent $arr[($b + 15), 13]

                $allAudits += [PSCustomObject]@{
                    operatorSheet = $sheetName
                    channelType = "wise_call"
                    sampleIndex = $sIdx + 1
                    callId = $callId
                    ticketId = $ticketId
                    duration = $dur
                    ringTime = $ring
                    creationTime = $null
                    takeTime = $null
                    date = $date
                    month = "09-2026"
                    appliesMda = $appliesMda
                    staysInMda = $true
                    isPas = $false
                    isCriticalFailure = $false
                    notes = if (-not $solicitudOk -and $rawTicket -ne "") { $rawTicket } else { $null }
                    excelSection1Score = $s1Score
                    excelSection2Score = $s2Score
                    excelTotalScore = $totalScore
                    scores = $scores
                }
            }
        }

        # 2. CANAL: WISE_EMAIL (Mails)
        $mailBases = @(0, 15, 30, 45)
        for ($sIdx = 0; $sIdx -lt 4; $sIdx++) {
            $b = $mailBases[$sIdx]
            $rawDate = CleanStr $arr[($b + 2), 17]
            $date = FormatExcelDate $rawDate $fallbackDates[$sIdx]
            $take = FormatExcelTime $arr[($b + 2), 18]

            $callId = CleanStr $arr[($b + 4), 16]
            # Si callId está vacío, buscar en fila b+3 o b+5 o ticket
            if ($callId -eq "") {
                $callId = CleanStr $arr[($b + 5), 16]
            }

            $rawTicket = CleanStr $arr[($b + 9), 24]
            $ticketId = $rawTicket
            if ($ticketId -eq "") {
                $ticketId = if ($callId -ne "") { $callId } else { "N/A" }
            }
            if ($callId -eq "") {
                $callId = $ticketId
            }

            $appliesMda = ParseBoolVal $arr[($b + 11), 23]

            $emailItemCodes = @(
                "email_interpretacion",
                "email_procedimientos",
                "email_gestion_herramientas",
                "email_redaccion",
                "email_claridad",
                "email_resolucion",
                "email_seguimiento"
            )
            $scores = @()
            for ($k = 0; $k -lt $emailItemCodes.Count; $k++) {
                $r = $b + 2 + $k
                $code = $emailItemCodes[$k]
                $val = ParseBoolVal $arr[$r, 23]
                $comm = CleanStr $arr[$r, 24]
                $scores += [PSCustomObject]@{
                    code = $code
                    score = $val
                    comment = if ($comm -ne "") { $comm } else { $null }
                }
            }
            # Solicitud info (b+9)
            $commSol = CleanStr $arr[($b + 9), 24]
            $scores += [PSCustomObject]@{
                code = "email_solicitud"
                score = ParseBoolVal $arr[($b + 9), 23]
                comment = if ($commSol -ne "") { $commSol } else { $null }
            }
            # SLA 90 min (b+10)
            $commSla = CleanStr $arr[($b + 10), 24]
            $scores += [PSCustomObject]@{
                code = "email_sla_90min"
                score = ParseBoolVal $arr[($b + 10), 23]
                comment = if ($commSla -ne "") { $commSla } else { $null }
            }

            # Section 2 MDA
            $emailMdaCodes = @(
                "email_mda_sla_resolucion",
                "email_mda_seguimiento",
                "email_mda_categorizacion_final",
                "email_mda_origen",
                "email_mda_tipo",
                "email_mda_categorizacion",
                "email_mda_ortografia",
                "email_mda_prioridad",
                "email_mda_titulo",
                "email_mda_descripcion",
                "email_mda_exactitud_datos",
                "email_mda_reclamo_novedad"
            )
            for ($k = 0; $k -lt $emailMdaCodes.Count; $k++) {
                $r = $b + 2 + $k
                $code = $emailMdaCodes[$k]
                $val = ParseBoolVal $arr[$r, 28]
                $comm = CleanStr $arr[$r, 29]
                $scores += [PSCustomObject]@{
                    code = $code
                    score = $val
                    comment = if ($comm -ne "") { $comm } else { $null }
                }
            }

            $totalScore = ParsePercent $arr[($b + 14), 28]

            $allAudits += [PSCustomObject]@{
                operatorSheet = $sheetName
                channelType = "wise_email"
                sampleIndex = $sIdx + 1
                callId = $callId
                ticketId = $ticketId
                duration = "00:00:00"
                ringTime = $null
                creationTime = $null
                takeTime = $take
                date = $date
                month = "09-2026"
                appliesMda = $appliesMda
                staysInMda = $true
                isPas = $false
                isCriticalFailure = $false
                notes = $null
                excelSection1Score = 0
                excelSection2Score = 0
                excelTotalScore = $totalScore
                scores = $scores
            }
        }

        # 3. CANAL: INVGATE_TICKET (Autogestiones)
        $agBases = @(0, 15, 30, 45)
        for ($sIdx = 0; $sIdx -lt 4; $sIdx++) {
            $b = $agBases[$sIdx]
            $rawDate = CleanStr $arr[($b + 2), 32]
            $date = FormatExcelDate $rawDate $fallbackDates[$sIdx]
            $take = FormatExcelTime $arr[($b + 2), 34]

            $rawTicket = CleanStr $arr[($b + 4), 31]
            $ticketId = $rawTicket
            if ($ticketId -eq "") { $ticketId = "N/A" }
            $isPas = ParseBoolVal $arr[($b + 4), 32]
            $staysInMda = ParseBoolVal $arr[($b + 10), 38]

            $agItemCodes = @(
                "ag_titulo",
                "ag_analisis",
                "ag_sondeo",
                "ag_procedimiento",
                "ag_documentacion",
                "ag_correccion_prioridad",
                "ag_correccion_tipo",
                "ag_categorizacion"
            )
            $scores = @()
            for ($k = 0; $k -lt $agItemCodes.Count; $k++) {
                $r = $b + 2 + $k
                $code = $agItemCodes[$k]
                $val = ParseBoolVal $arr[$r, 38]
                $comm = CleanStr $arr[$r, 39]
                $scores += [PSCustomObject]@{
                    code = $code
                    score = $val
                    comment = if ($comm -ne "") { $comm } else { $null }
                }
            }

            $agMdaCodes = @(
                "ag_mda_sla_primera_respuesta",
                "ag_mda_sla_resolucion",
                "ag_mda_seguimiento",
                "ag_mda_categorizacion_final",
                "ag_mda_info_complementaria",
                "ag_mda_ortografia"
            )
            for ($k = 0; $k -lt $agMdaCodes.Count; $k++) {
                $r = $b + 2 + $k
                $code = $agMdaCodes[$k]
                $val = ParseBoolVal $arr[$r, 43]
                $comm = CleanStr $arr[$r, 44]
                $scores += [PSCustomObject]@{
                    code = $code
                    score = $val
                    comment = if ($comm -ne "") { $comm } else { $null }
                }
            }

            $totalScore = ParsePercent $arr[($b + 14), 43]

            $allAudits += [PSCustomObject]@{
                operatorSheet = $sheetName
                channelType = "invgate_ticket"
                sampleIndex = $sIdx + 1
                callId = $ticketId
                ticketId = $ticketId
                duration = "00:00:00"
                ringTime = $null
                creationTime = $null
                takeTime = $take
                date = $date
                month = "09-2026"
                appliesMda = $true
                staysInMda = $staysInMda
                isPas = $isPas
                isCriticalFailure = $false
                notes = $null
                excelSection1Score = 0
                excelSection2Score = 0
                excelTotalScore = $totalScore
                scores = $scores
            }
        }
    }

    $wb.Close($false)
} finally {
    $excel.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
}

Write-Host "Total de auditorías extraídas: $($allAudits.Count)"
$json = $allAudits | ConvertTo-Json -Depth 6
$fullPath = [System.IO.Path]::GetFullPath($OutputPath)
[System.IO.File]::WriteAllText($fullPath, $json, [System.Text.Encoding]::UTF8)
Write-Host "JSON exportado exitosamente a: $OutputPath"
