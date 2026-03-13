import { Controller, Get, Param, StreamableFile } from '@nestjs/common';
import { FileDownloadService } from './application/file-download.service';

@Controller('downloads')
export class DownloadsController {
  constructor(private readonly fileDownloadService: FileDownloadService) {}

  @Get(':fileId')
  async downloadFile(@Param('fileId') fileId: string): Promise<StreamableFile> {
    const { stream, file } = await this.fileDownloadService.openForRead(fileId);

    return new StreamableFile(stream, {
      type: file.contentType,
      disposition: `attachment; filename="${file.fileName}"`
    });
  }
}
