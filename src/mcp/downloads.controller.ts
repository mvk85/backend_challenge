import { Controller, Get, Param, StreamableFile } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiProduces, ApiTags } from '@nestjs/swagger';
import { FileDownloadService } from './application/file-download.service';

@ApiTags('downloads')
@Controller('downloads')
export class DownloadsController {
  constructor(private readonly fileDownloadService: FileDownloadService) {}

  @ApiOperation({ summary: 'Download file by id' })
  @ApiParam({ name: 'fileId', description: 'Identifier returned by file tools provider' })
  @ApiProduces('application/octet-stream')
  @ApiOkResponse({ description: 'Binary file stream' })
  @Get(':fileId')
  async downloadFile(@Param('fileId') fileId: string): Promise<StreamableFile> {
    const { stream, file } = await this.fileDownloadService.openForRead(fileId);

    return new StreamableFile(stream, {
      type: file.contentType,
      disposition: `attachment; filename="${file.fileName}"`
    });
  }
}
