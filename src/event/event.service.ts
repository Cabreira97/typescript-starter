// src/event/event.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaClient, Event, Volunteer } from '@prisma/client';

import { randomUUID } from 'crypto';
import axios from 'axios';
import { CreateEventDto } from './dtos/create-event.dto';
import { UpdateEventDto } from './dtos/update-event.dto';

@Injectable()
export class EventService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async create(data: CreateEventDto): Promise<Event> {
    if (!data.location || !data.title) {
      throw new BadRequestException('Missing required fields');
    }
    return this.prisma.event.create({
      data: {
        location: data.location,
        title: data.title,
        description: data.description || null,
        organizer: { connect: { id: data.organizerId } }, // Conectar o organizador pelo ID
        date: new Date(data.date),
        volunteerId: data.volunteerId,
        price: data.price, // Adicionar um valor padrão para price, se necessário
        image_url: '', // Adicionar um valor padrão para image_url, se necessário
      },
    });
  }

  async findAll(): Promise<Event[]> {
    return this.prisma.event.findMany();
  }

  async findOne(id: string): Promise<Event | null> {
    return this.prisma.event.findUnique({ where: { id } });
  }

  async update(id: string, data: UpdateEventDto): Promise<Event> {
    return this.prisma.event.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Event> {
    return this.prisma.event.delete({ where: { id } });
  }

  async pay(id: string): Promise<
    | {
        id: string;
        link: string;
      }
    | Error
  > {
    try {
      const event = await this.prisma.event.findUnique({ where: { id } });
      if (!event) {
        throw new Error('Event not found');
      }

      const options = {
        method: 'POST',
        url: 'https://sandbox.api.pagseguro.com/checkouts',
        headers: {
          accept: '*/*',
          Authorization: `Bearer ${process.env.PAGBANK_TOKEN}`,
          'Content-type': 'application/json',
        },
        data: {
          reference_id: randomUUID(),
          expiration_date: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          customer_modifiable: true,
          items: [
            {
              reference_id: event.id,
              name: event.title,
              quantity: 1,
              unit_amount: event.price,
            },
          ],
          additional_amount: 0,
          discount_amount: 0,
          payment_methods: [
            { type: 'CREDIT_CARD', brands: ['mastercard', 'visa'] },
            { type: 'DEBIT_CARD', brands: ['visa', 'mastercard'] },
            { type: 'PIX' },
          ],
          payment_methods_configs: [
            {
              type: 'CREDIT_CARD',
              config_options: [{ option: 'INSTALLMENTS_LIMIT', value: '3' }],
            },
          ],
          soft_descriptor: 'ConnecTech',
        },
      };

      const response = await axios.request(options);

      if (response.status !== 201) {
        throw new Error('Error while processing payment');
      } else {
        const retorno = {
          id: response.data.id,
          link: response.data.links[1].href,
        };
        return retorno;
      }
    } catch (error) {
      throw new Error('Error while processing payment');
    }
  }

  async findVolunteers(eventId: string): Promise<Volunteer[]> {
    return this.prisma.volunteer.findMany({
      where: { eventId },
    });
  }
}
