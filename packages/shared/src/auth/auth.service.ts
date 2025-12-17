import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User, AuthToken, JwtPayload, LoginRequest, RegisterRequest, PERMISSIONS, ROLE_PERMISSIONS } from '../types/auth.types';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    // This would typically query the database
    // For now, return a mock user for demonstration
    const mockUser: User = {
      id: '1',
      email,
      username: email.split('@')[0],
      firstName: 'John',
      lastName: 'Doe',
      roles: ['user'],
      permissions: ROLE_PERMISSIONS.user,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // In real implementation, compare hashed password
    // const isValidPassword = await bcrypt.compare(password, user.password);
    const isValidPassword = password === 'password'; // Mock validation

    return isValidPassword ? mockUser : null;
  }

  async login(loginRequest: LoginRequest): Promise<AuthToken> {
    const user = await this.validateUser(loginRequest.email, loginRequest.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      roles: user.roles,
      permissions: user.permissions,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 900, // 15 minutes
      iss: 'kronos-auth',
      aud: 'kronos-services',
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.generateRefreshToken();

    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
      tokenType: 'Bearer',
    };
  }

  async register(registerRequest: RegisterRequest): Promise<User> {
    // Validate input
    if (!registerRequest.email || !registerRequest.password) {
      throw new BadRequestException('Email and password are required');
    }

    // Check if user already exists
    // const existingUser = await this.userRepository.findByEmail(registerRequest.email);
    // if (existingUser) {
    //   throw new BadRequestException('User already exists');
    // }

    // Hash password
    const hashedPassword = await bcrypt.hash(registerRequest.password, 12);

    // Create user
    const user: User = {
      id: Date.now().toString(), // In real app, use UUID
      email: registerRequest.email,
      username: registerRequest.username,
      firstName: registerRequest.firstName,
      lastName: registerRequest.lastName,
      roles: ['user'],
      permissions: ROLE_PERMISSIONS.user,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Save to database (mock implementation)
    // await this.userRepository.create(user);

    return user;
  }

  async validateToken(token: string): Promise<JwtPayload> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      return payload;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthToken> {
    // Validate refresh token (implementation depends on storage strategy)
    // For now, return a new token pair
    const payload: JwtPayload = {
      sub: '1',
      email: 'user@example.com',
      username: 'user',
      roles: ['user'],
      permissions: ROLE_PERMISSIONS.user,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 900,
      iss: 'kronos-auth',
      aud: 'kronos-services',
    };

    const accessToken = this.jwtService.sign(payload);
    const newRefreshToken = this.generateRefreshToken();

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: 900,
      tokenType: 'Bearer',
    };
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    // In real implementation, fetch user from database
    return ROLE_PERMISSIONS.user;
  }

  async hasPermission(userId: string, permission: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissions.includes(permission);
  }

  private generateRefreshToken(): string {
    // In production, use a secure random string and store in database
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}