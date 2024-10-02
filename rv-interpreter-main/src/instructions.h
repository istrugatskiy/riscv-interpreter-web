#pragma once
#include "hash_table.h"
#include "label_table.h"
#include <ctype.h>
#include <inttypes.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

uint64_t registers[32] = {0};
hashtable *memory;
labeltable *labels;
labeltable *abi_map;

// R TYPE

void r_add(int rd, int rs1, int rs2) {
  registers[rd] = registers[rs1] + registers[rs2];
}

void r_sub(int rd, int rs1, int rs2) {
  registers[rd] = (int64_t)registers[rs1] - (int64_t)registers[rs2];
}

void r_and(int rd, int rs1, int rs2) {
  registers[rd] = registers[rs1] & registers[rs2];
}

void r_or(int rd, int rs1, int rs2) {
  registers[rd] = registers[rs1] | registers[rs2];
}

void r_xor(int rd, int rs1, int rs2) {
  registers[rd] = registers[rs1] ^ registers[rs2];
}

void r_slt(int rd, int rs1, int rs2) {
  registers[rd] = (int64_t)registers[rs1] < (int64_t)registers[rs2];
}

void r_sltu(int rd, int rs1, int rs2) {
  registers[rd] = registers[rs1] < registers[rs2];
}

void r_sll(int rd, int rs1, int rs2) {
  registers[rd] = registers[rs1] << (registers[rs2] & 0x3F);
}

void r_sra(int rd, int rs1, int rs2) {
  registers[rd] = (int64_t)registers[rs1] >> (registers[rs2] & 0x3F);
}

void r_srl(int rd, int rs1, int rs2) {
  registers[rd] = registers[rs1] >> (registers[rs2] & 0x3F);
}

void r_addw(int rd, int rs1, int rs2) {
  int32_t result = (int32_t)(registers[rs1] & 0xFFFFFFFF) +
                   (int32_t)(registers[rs2] & 0xFFFFFFFF);
  registers[rd] = (int64_t)result;
}

void r_sllw(int rd, int rs1, int rs2) {
  uint32_t result = (uint32_t)(registers[rs1] & 0xFFFFFFFF)
                    << (uint32_t)(registers[rs2] & 0x1F);
  registers[rd] = (int64_t)result;
}

void r_srlw(int rd, int rs1, int rs2) {
  uint32_t result = (uint32_t)(registers[rs1] & 0xFFFFFFFF) >>
                    (uint32_t)(registers[rs2] & 0x1F);
  registers[rd] = (int64_t)result;
}

void r_subw(int rd, int rs1, int rs2) {
  int32_t result = (int32_t)(registers[rs1] & 0xFFFFFFFF) -
                   (int32_t)(registers[rs2] & 0xFFFFFFFF);
  registers[rd] = (int64_t)result;
}

void r_sraw(int rd, int rs1, int rs2) {
  int32_t result = (int32_t)(registers[rs1] & 0xFFFFFFFF) >>
                   (uint32_t)(registers[rs2] & 0x1F);
  registers[rd] = (int64_t)result;
}

// I TYPE

void r_addi(int rd, int rs1, uint64_t imm) {
  registers[rd] = registers[rs1] + imm;
}

void r_andi(int rd, int rs1, uint64_t imm) {
  registers[rd] = registers[rs1] & imm;
}

void r_ori(int rd, int rs1, uint64_t imm) {
  registers[rd] = registers[rs1] | imm;
}

void r_xori(int rd, int rs1, uint64_t imm) {
  registers[rd] = registers[rs1] ^ imm;
}

void r_slti(int rd, int rs1, uint64_t imm) {
  registers[rd] = (int64_t)registers[rs1] < (int64_t)imm;
}

void r_sltiu(int rd, int rs1, uint64_t imm) {
  registers[rd] = registers[rs1] < imm;
}

void r_addiw(int rd, int rs1, uint64_t imm) {
  int32_t result =
      (int32_t)(registers[rs1] & 0xFFFFFFFF) + (int32_t)(imm & 0xFFFFFFFF);
  registers[rd] = (int64_t)result;
}

void r_slli(int rd, int rs1, uint64_t imm) {
  registers[rd] = registers[rs1] << (imm & 0x3F);
}

void r_slliw(int rd, int rs1, uint64_t imm) {
  int32_t result = (int32_t)(registers[rs1] & 0xFFFFFFFF)
                   << (uint32_t)(imm & 0x1F);
  registers[rd] = (int64_t)result;
}

void r_srli(int rd, int rs1, uint64_t imm) {
  registers[rd] = registers[rs1] >> (imm & 0x3F);
}

void r_srliw(int rd, int rs1, uint64_t imm) {
  uint32_t result =
      (uint32_t)(registers[rs1] & 0xFFFFFFFF) >> (uint32_t)(imm & 0x1F);
  registers[rd] = (int64_t)(int32_t)result;
}

void r_srai(int rd, int rs1, uint64_t imm) {
  registers[rd] = (int64_t)registers[rs1] >> (imm & 0x3F);
}

void r_sraiw(int rd, int rs1, uint64_t imm) {
  int32_t result =
      (int32_t)(registers[rs1] & 0xFFFFFFFF) >> (uint32_t)(imm & 0x1F);
  registers[rd] = (int64_t)result;
}

// MEM TYPE

void r_lb(int rd, int rs1, uint64_t imm) {
  uint64_t byte = ht_get(memory, imm + registers[rs1]);
  byte = byte & 0x80 ? byte | 0xFFFFFFFFFFFFFF00 : byte;
  registers[rd] = byte;
}

void r_lh(int rd, int rs1, uint64_t imm) {
  uint64_t toh = 0;
  toh += (ht_get(memory, imm + registers[rs1]) & 0xFF);
  toh += ((ht_get(memory, 1 + (imm + registers[rs1])) & 0xFF) << 8);
  toh = toh & 0x8000 ? toh | 0xFFFFFFFFFFFF0000 : toh;
  registers[rd] = toh;
}

void r_lw(int rd, int rs1, uint64_t imm) {
  uint64_t tow = 0;
  for (int i = 0; i < 4; ++i) {
    tow += ((ht_get(memory, i + (imm + registers[rs1])) & 0xFF) << (8 * i));
  }
  tow = tow & 0x80000000 ? tow | 0xFFFFFFFF00000000 : tow;
  registers[rd] = tow;
}

void r_ld(int rd, int rs1, uint64_t imm) {
  uint64_t tod = 0;
  for (int i = 0; i < 8; ++i) {
    tod += ((ht_get(memory, i + (imm + registers[rs1])) & 0xFF) << (8 * i));
  }
  registers[rd] = tod;
}

void r_sb(int rs1, int rs2, uint64_t imm, int off) {
  uint64_t byte = (registers[rs2] >> (8 * off)) & 0xFF;
  byte = byte & 0x80 ? byte | 0xFFFFFFFFFFFFFF00 : byte;
  ht_insert(memory, registers[rs1] + imm + off, byte);
}

void r_sh(int rs1, int rs2, uint64_t imm) {
  r_sb(rs1, rs2, imm, 0);
  r_sb(rs1, rs2, imm, 1);
}

void r_sw(int rs1, int rs2, uint64_t imm) {
  for (int i = 0; i < 4; ++i) {
    r_sb(rs1, rs2, imm, i);
  }
}

void r_sd(int rs1, int rs2, uint64_t imm) {
  for (int i = 0; i < 8; ++i) {
    r_sb(rs1, rs2, imm, i);
  }
}

// U TYPE
void r_lui(int rd, uint64_t imm) {
  uint64_t shifted = imm << 12;
  registers[rd] = shifted & 0x80000000 ? shifted | 0xFFFFFFFF80000000 : shifted;
}

void r_auipc(int rd, uint64_t imm, int line) {
  uint64_t shifted = imm << 12;
  shifted = shifted & 0x80000000 ? shifted | 0xFFFFFFFF80000000 : shifted;
  registers[rd] = line + shifted;
}

// B TYPE

int r_beq(int rs1, int rs2, uint64_t imm, int line) {
  if (registers[rs1] == registers[rs2]) {
    return imm;
  }
  return line + 4;
}

int r_bne(int rs1, int rs2, uint64_t imm, int line) {
  if (registers[rs1] != registers[rs2]) {
    return imm;
  }
  return line + 4;
}

int r_blt(int rs1, int rs2, uint64_t imm, int line) {
  if ((int64_t)registers[rs1] < (int64_t)registers[rs2]) {
    return imm;
  }
  return line + 4;
}

int r_bltu(int rs1, int rs2, uint64_t imm, int line) {
  if (registers[rs1] < registers[rs2]) {
    return imm;
  }
  return line + 4;
}

int r_bge(int rs1, int rs2, uint64_t imm, int line) {
  if ((int64_t)registers[rs1] >= (int64_t)registers[rs2]) {
    return imm;
  }
  return line + 4;
}

int r_bgeu(int rs1, int rs2, uint64_t imm, int line) {
  if (registers[rs1] >= registers[rs2]) {
    return imm;
  }
  return line + 4;
}

// J TYPE

int r_jal(int rd, uint64_t imm, int line) {
  if (rd != 0) {
    registers[rd] = line + 4;
  }
  return imm;
}

int r_jalr(int rd, int rs1, uint64_t imm, int line) {
  if (rd != 0) {
    registers[rd] = line + 4;
  }
  return (imm + registers[rs1]) & ~1;
}
