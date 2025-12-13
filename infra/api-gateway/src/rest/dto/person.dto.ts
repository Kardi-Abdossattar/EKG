import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, IsIn } from 'class-validator';

export class CreatePersonDto {
  @ApiProperty({ example: 'John Doe', description: 'Full name of the person' })
  @IsNotEmpty()
  @IsString()
  fullName: string;

  @ApiProperty({ example: 'john.doe@example.com', description: 'Email address' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Software Engineer', description: 'Job role', required: false })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiProperty({ example: 'http://example.com/data#OU_ENG', description: 'OrgUnit ID', required: false })
  @IsOptional()
  @IsString()
  orgUnitId?: string;

  @ApiProperty({ example: 'Interne', description: 'Security label', required: false, enum: ['Public', 'Interne', 'Confidentiel', 'Secret'] })
  @IsOptional()
  @IsIn(['Public', 'Interne', 'Confidentiel', 'Secret'])
  label?: string;
}

export class UpdatePersonDto {
  @ApiProperty({ example: 'John Doe Updated', description: 'Full name of the person', required: false })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiProperty({ example: 'john.updated@example.com', description: 'Email address', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: 'Senior Engineer', description: 'Job role', required: false })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiProperty({ example: 'http://example.com/data#OU_HR', description: 'OrgUnit ID', required: false })
  @IsOptional()
  @IsString()
  orgUnitId?: string;
}
