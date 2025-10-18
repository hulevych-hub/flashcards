export interface Rating {
id: number | null; // Could be stringified int
description: string; // extensible;
order: number; // 1,2,3...
color?: string; // hex color code, e.g. #FF0000
}