import { ApiProperty } from '@nestjs/swagger';

export class UploadRagFileResponseDto {
  @ApiProperty({ example: 'factory-20260317191540-a1b2c3.txt' })
  fileId!: string;

  @ApiProperty({ example: '/Users/maksim/learn_ai/firstai/backend/storage/files/factory-20260317191540-a1b2c3.txt' })
  filePath!: string;

  @ApiProperty({ example: 'factory.txt' })
  originalName!: string;

  @ApiProperty({ example: 1842 })
  size!: number;

  @ApiProperty({ example: 'text/plain' })
  mimeType!: string;
}
