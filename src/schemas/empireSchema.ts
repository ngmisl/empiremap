import { z } from 'zod';

/**
 * Schema for individual empire data
 * Validates the structure of empire objects received from the API
 */
export const EmpireSchema = z.object({
  base_token: z.string()
    .min(1, "Base token identifier is required")
    .describe('Unique identifier for the empire token'),
  
  token_name: z.string()
    .min(1, "Token name is required")
    .describe('Full name of the empire token'),
  
  token_symbol: z.string()
    .min(1, "Token symbol is required")
    .describe('Symbol/ticker of the empire token'),
  
  total_distributed: z.number()
    .nonnegative("Total distributed value must be non-negative")
    .describe('Total distributed value in USD'),
  
  total_burned: z.number()
    .nonnegative("Total burned tokens must be non-negative")
    .describe('Total number of tokens burned'),
  
  logo_uri: z.string()
    .url("Logo URI must be a valid URL")
    .optional()
    .describe('URI to the empire logo image'),
});

/**
 * Schema for API response containing multiple empires
 * Validates the overall structure of the API response
 */
export const EmpiresResponseSchema = z.object({
  empires: z.array(EmpireSchema)
    .min(1, "At least one empire must be present in the response")
    .describe('Array of empire objects'),
  
  totalCount: z.number()
    .int("Total count must be an integer")
    .nonnegative("Total count must be non-negative")
    .describe('Total count of empires'),
  
  queryTime: z.number()
    .describe('Query execution time'),
  
  page: z.number()
    .int("Page number must be an integer")
    .positive("Page number must be positive")
    .describe('Current page number'),
  
  itemsPerPage: z.number()
    .int("Items per page must be an integer")
    .positive("Items per page must be positive")
    .describe('Number of items per page'),
});

/**
 * Detailed error formatter for Zod validation errors
 * Transforms Zod errors into a more readable format for debugging and user feedback
 */
export const formatZodError = (error: z.ZodError): string => {
  return error.errors.map(err => {
    const path = err.path.join('.');
    return `${path ? `${path}: ` : ''}${err.message}`;
  }).join('; ');
};

/**
 * Type definitions derived from Zod schemas
 */
export type Empire = z.infer<typeof EmpireSchema>;
export type EmpiresResponse = z.infer<typeof EmpiresResponseSchema>;

/**
 * Territory interface for map visualization
 * Represents a region on the map associated with an empire
 */
export interface Territory {
  id: number;
  name: string;
  path: string;
  color: string;
  neighbors: number[];
  empire?: Empire;
}

/**
 * Medieval theme color palette for map visualization
 * These colors are designed to complement the medieval aesthetic
 */
export const medievalColors = [
  '#8C5523', // Brown
  '#2E4052', // Navy
  '#607744', // Olive
  '#BC4749', // Rust
  '#D5A021', // Gold
  '#5B3758', // Purple
  '#1D7874', // Teal
  '#8E5572', // Mauve
  '#3F4045', // Charcoal
  '#9B2915', // Brick
];
