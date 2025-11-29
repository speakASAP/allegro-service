/**
 * Products Module
 */

import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { PrismaModule, LoggerModule, AuthModule } from '@allegro/shared';

@Module({
  imports: [PrismaModule, LoggerModule, AuthModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}

