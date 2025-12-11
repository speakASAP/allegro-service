import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, LoggerService } from '@allegro/shared';
import { ProductsService } from './products.service';

@Controller('allegro/products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('ProductsController');
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getProducts(@Query() query: any) {
    const data = await this.productsService.getProducts(query);
    return { success: true, data };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getProduct(@Param('id') id: string) {
    const data = await this.productsService.getProduct(id);
    return { success: true, data };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async createProduct(@Body() body: any) {
    this.logger.log('[createProduct] Creating product', { allegroProductId: body.allegroProductId });
    const data = await this.productsService.createProduct(body);
    return { success: true, data };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async updateProduct(@Param('id') id: string, @Body() body: any) {
    this.logger.log('[updateProduct] Updating product', { id, allegroProductId: body.allegroProductId });
    const data = await this.productsService.updateProduct(id, body);
    return { success: true, data };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteProduct(@Param('id') id: string) {
    this.logger.log('[deleteProduct] Deleting product', { id });
    await this.productsService.deleteProduct(id);
    return { success: true };
  }
}

