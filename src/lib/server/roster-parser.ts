import ExcelJS from 'exceljs';
import { parseWorkshopRole, type WorkshopRole } from '$lib/workshop-roles';

/**
 * Parses the upstream "LCI user assignments" Excel into normalized rows.
 *
 * Expected layout (see Copie de lci user assignments for surveys *.xlsx):
 *   - Sheet `workstream assignments`
 *   - Row 6 is the column header row:
 *       B=Name  C=Email
 *       D=Project Managers  (Workstream 1a → W1, role PM)
 *       E=Consultants       (Workstream 1b → W1, role Engineer)
 *       F=Systems Baseline  (Workstream 2  → W2, role IT)
 *       G=External Integrations (Workstream 3 → W3)
 *       H=Strategic Objectives  (Workstream 4 → W4)
 *   - Each cell holds `1` if the person is in that workstream, else empty.
 *
 * Role precedence per person: PM > Engineer > IT > null.
 * Workshops: union of all checked columns.
 */

export interface ParsedRosterRow {
	name: string;
	email: string;
	workshopRole: WorkshopRole | null;
	workshopCodes: string[];
}

interface Mapping {
	col: number; // 1-based ExcelJS column index
	code: string; // Workshop code, e.g. 'W1'
	role: WorkshopRole | null; // Role to consider if this column = 1
}

// Order matters: role precedence is the first matching column.
const COLUMN_MAP: Mapping[] = [
	{ col: 4, code: 'W1', role: 'PM' }, // D — 1a
	{ col: 5, code: 'W1', role: 'Engineer' }, // E — 1b
	{ col: 6, code: 'W2', role: 'IT' }, // F — 2
	{ col: 7, code: 'W3', role: null }, // G — 3
	{ col: 8, code: 'W4', role: null } // H — 4
];

const NAME_COL = 2; // B
const EMAIL_COL = 3; // C
const DATA_START_ROW = 7; // first person row in the source spreadsheet

function isChecked(cell: ExcelJS.Cell): boolean {
	const v = cell.value;
	if (v == null) return false;
	if (typeof v === 'number') return v !== 0;
	if (typeof v === 'string') return v.trim() !== '' && v.trim() !== '0';
	if (typeof v === 'boolean') return v;
	return false;
}

function cellText(cell: ExcelJS.Cell): string {
	const v = cell.value;
	if (v == null) return '';
	if (typeof v === 'string') return v.trim();
	if (typeof v === 'number' || typeof v === 'boolean') return String(v);
	if (typeof v === 'object' && 'text' in v) {
		// Rich text or hyperlink
		const t = (v as { text?: string }).text;
		return typeof t === 'string' ? t.trim() : '';
	}
	return '';
}

export async function parseRosterWorkbook(
	buffer: ArrayBuffer
): Promise<{ rows: ParsedRosterRow[]; warnings: string[] }> {
	const wb = new ExcelJS.Workbook();
	await wb.xlsx.load(buffer);

	// Find a sheet that looks like the assignments sheet — case-insensitive
	// match on the name keeps us tolerant to small renames.
	const sheet =
		wb.worksheets.find((s) => /workstream|assignment/i.test(s.name)) ?? wb.worksheets[0];
	if (!sheet) {
		return { rows: [], warnings: ['No worksheet found in workbook'] };
	}

	const rows: ParsedRosterRow[] = [];
	const warnings: string[] = [];
	const seenEmails = new Set<string>();

	for (let r = DATA_START_ROW; r <= sheet.rowCount; r++) {
		const row = sheet.getRow(r);
		const name = cellText(row.getCell(NAME_COL));
		const email = cellText(row.getCell(EMAIL_COL)).toLowerCase();
		if (!email) continue; // skip blank rows
		if (!email.includes('@')) {
			warnings.push(`Row ${r}: skipping malformed email "${email}"`);
			continue;
		}
		if (seenEmails.has(email)) {
			warnings.push(`Row ${r}: duplicate email "${email}" (keeping first occurrence)`);
			continue;
		}

		const codes = new Set<string>();
		let role: WorkshopRole | null = null;
		for (const m of COLUMN_MAP) {
			if (isChecked(row.getCell(m.col))) {
				codes.add(m.code);
				if (role === null && m.role !== null) role = m.role;
			}
		}

		if (!codes.size) continue; // no assignments → nothing to track

		seenEmails.add(email);
		rows.push({
			name: name || email,
			email,
			workshopRole: parseWorkshopRole(role), // re-validate against canonical list
			workshopCodes: [...codes].sort()
		});
	}

	return { rows, warnings };
}
