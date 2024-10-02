// I am sorry Peter for cannibalizing your beautiful C :(
#include "hash_table.h"
#include "label_table.h"
#include <ctype.h>
#include <emscripten.h>
#include <inttypes.h>
#include <limits.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "format.h"
#include "instructions.h"

int sim_PC = 0;
char **code_lines;
int total_lines;
// btw I realize this is a terrible way of doing this.
// This code is terrible...
EMSCRIPTEN_KEEPALIVE
int step(char *instruction, int line) {
  const char *inst_copy = strdup(instruction);
  while (isspace(*instruction)) {
    instruction++;
  }
  char *op = strsep(&instruction, " ");
  int op_type = get_op_type(op);

  if (op_type == R_TYPE) {
    if (!validate_format(instruction, 3, 0)) {
      printf("Malformed instruction.\nPlease reset.\n");
      return INT_MIN;
    }
    char *tokens = strtok(instruction, ", ");
    char *rd_s = tokens;
    int rd = get_register(rd_s);
    tokens = strtok(NULL, ", ");
    char *rs1_s = tokens;
    int rs1 = get_register(rs1_s);
    tokens = strtok(NULL, ", ");
    char *rs2_s = tokens;
    int rs2 = get_register(rs2_s);

    if (rd == -1 || rs1 == -1 || rs2 == -1) {
      return INT_MIN;
    }

    if (rd == 0) {
      return line + 4;
    }

    if (strcmp(op, "add") == 0) {
      r_add(rd, rs1, rs2);
    } else if (strcmp(op, "sub") == 0) {
      r_sub(rd, rs1, rs2);
    } else if (strcmp(op, "and") == 0) {
      r_and(rd, rs1, rs2);
    } else if (strcmp(op, "or") == 0) {
      r_or(rd, rs1, rs2);
    } else if (strcmp(op, "xor") == 0) {
      r_xor(rd, rs1, rs2);
    } else if (strcmp(op, "slt") == 0) {
      r_slt(rd, rs1, rs2);
    } else if (strcmp(op, "sltu") == 0) {
      r_sltu(rd, rs1, rs2);
    } else if (strcmp(op, "sll") == 0) {
      r_sll(rd, rs1, rs2);
    } else if (strcmp(op, "sra") == 0) {
      r_sra(rd, rs1, rs2);
    } else if (strcmp(op, "srl") == 0) {
      r_srl(rd, rs1, rs2);
    } else if (strcmp(op, "addw") == 0) {
      r_addw(rd, rs1, rs2);
    } else if (strcmp(op, "sllw") == 0) {
      r_sllw(rd, rs1, rs2);
    } else if (strcmp(op, "srlw") == 0) {
      r_srlw(rd, rs1, rs2);
    } else if (strcmp(op, "subw") == 0) {
      r_subw(rd, rs1, rs2);
    } else if (strcmp(op, "sraw") == 0) {
      r_sraw(rd, rs1, rs2);
    }
  } else if (op_type == I_TYPE) {
    if (!validate_format(instruction, 3, 0)) {
      printf("Malformed instruction.\nPlease reset.\n");
      return INT_MIN;
    }
    char *tokens = strtok(instruction, ", ");
    char *rd_s = tokens;
    int rd = get_register(rd_s);
    tokens = strtok(NULL, ", ");
    char *rs1_s = tokens;
    int rs1 = get_register(rs1_s);
    tokens = strtok(NULL, ", ");
    if (rd == -1 || rs1 == -1) {
      return INT_MIN;
    }
    char *imm_s = tokens;
    uint64_t imm;
    if (strncmp(imm_s, "0x", 2) == 0) {
      if (!(is_hex_digits(imm_s + 2))) {
        printf("Not a valid immediate.\nPlease reset.\n");
        return INT_MIN;
      }
      imm = strtoull(imm_s, NULL, 16);
    } else if (strncmp(imm_s, "-0x", 3) == 0) {
      if (!(is_hex_digits(imm_s + 3))) {
        printf("Not a valid immediate.\nPlease reset.\n");
        return INT_MIN;
      }
      imm = strtoull(imm_s, NULL, 16);
    } else {
      if (!(is_decimal_digits(imm_s))) {
        printf("Not a valid immediate.\nPlease reset.\n");
        return INT_MIN;
      }
      imm = strtoull(imm_s, NULL, 10);
    }
    if ((int64_t)imm > 2047 || (int64_t)imm < -2048) {
      printf("Immediate is too large.\nExpected in range [-2048, "
             "2047].\nPlease reset.\n");
      return INT_MIN;
    }

    if (rd == 0) {
      return line + 4;
    }

    if (strcmp(op, "addi") == 0) {
      r_addi(rd, rs1, imm);
    } else if (strcmp(op, "andi") == 0) {
      r_andi(rd, rs1, imm);
    } else if (strcmp(op, "ori") == 0) {
      r_ori(rd, rs1, imm);
    } else if (strcmp(op, "xori") == 0) {
      r_xori(rd, rs1, imm);
    } else if (strcmp(op, "slti") == 0) {
      r_slti(rd, rs1, imm);
    } else if (strcmp(op, "sltiu") == 0) {
      r_sltiu(rd, rs1, imm);
    } else if (strcmp(op, "addiw") == 0) {
      r_addiw(rd, rs1, imm);
    } else if (strcmp(op, "slli") == 0) {
      r_slli(rd, rs1, imm);
    } else if (strcmp(op, "slliw") == 0) {
      r_slliw(rd, rs1, imm);
    } else if (strcmp(op, "srli") == 0) {
      r_srli(rd, rs1, imm);
    } else if (strcmp(op, "srliw") == 0) {
      r_srliw(rd, rs1, imm);
    } else if (strcmp(op, "srai") == 0) {
      r_srai(rd, rs1, imm);
    } else if (strcmp(op, "sraiw") == 0) {
      r_sraiw(rd, rs1, imm);
    }
  } else if (op_type == MEM_TYPE) {
    if (!validate_parentheses_format(instruction)) {
      printf("Malformed instruction.\nPlease reset.\n");
      return INT_MIN;
    }
    // rd or rs2
    char *tokens = strtok(instruction, ", ()");
    char *rds2_s = tokens;
    int rds2 = get_register(rds2_s);
    tokens = strtok(NULL, ", ()");
    char *imm_s = tokens;
    uint64_t imm;
    if (strncmp(imm_s, "0x", 2) == 0) {
      if (!(is_hex_digits(imm_s + 2))) {
        printf("Not a valid immediate.\nPlease reset.\n");
        return INT_MIN;
      }
      imm = strtoull(imm_s, NULL, 16);
    } else if (strncmp(imm_s, "-0x", 3) == 0) {
      if (!(is_hex_digits(imm_s + 3))) {
        printf("Not a valid immediate.\nPlease reset.\n");
        return INT_MIN;
      }
      imm = strtoull(imm_s, NULL, 16);
    } else {
      if (!(is_decimal_digits(imm_s))) {
        printf("Not a valid immediate.\nPlease reset.\n");
        return INT_MIN;
      }
      imm = strtoull(imm_s, NULL, 10);
    }
    if ((int64_t)imm > 2047 || (int64_t)imm < -2048) {
      printf("Immediate is too large.\nExpected in range [-2048, "
             "2047].\nPlease reset.\n");
      return INT_MIN;
    }
    tokens = strtok(NULL, ", ()");
    char *rs1_s = tokens;
    int rs1 = get_register(rs1_s);

    if (rds2 == -1 || rs1 == -1) {
      return INT_MIN;
    }

    if (registers[rs1] + imm > 0x7FFFFFFFFFFFFFFF) {
      printf("Valid memory addresses are between 0x0 and "
             "0x7FFFFFFFFFFFFFFF\nPlease reset.\n");
      return INT_MIN;
    }

    if (strcmp(op, "lb") == 0) {
      if (rds2 == 0) {
        return line + 4;
      }
      r_lb(rds2, rs1, imm);
    } else if (strcmp(op, "lh") == 0) {
      if (rds2 == 0) {
        return line + 4;
      }
      r_lh(rds2, rs1, imm);
    } else if (strcmp(op, "lw") == 0) {
      if (rds2 == 0) {
        return line + 4;
      }
      r_lw(rds2, rs1, imm);
    } else if (strcmp(op, "ld") == 0) {
      if (rds2 == 0) {
        return line + 4;
      }
      r_ld(rds2, rs1, imm);
    } else if (strcmp(op, "sb") == 0) {
      r_sb(rs1, rds2, imm, 0);
    } else if (strcmp(op, "sh") == 0) {
      r_sh(rs1, rds2, imm);
    } else if (strcmp(op, "sw") == 0) {
      r_sw(rs1, rds2, imm);
    } else if (strcmp(op, "sd") == 0) {
      r_sd(rs1, rds2, imm);
    }
  } else if (op_type == U_TYPE) {
    if (!validate_format(instruction, 2, 0)) {
      printf("Malformed instruction.\nPlease reset.\n");
      return INT_MIN;
    }
    char *tokens = strtok(instruction, ", ");
    char *rd_s = tokens;
    int rd = get_register(rd_s);
    if (rd == -1) {
      return INT_MIN;
    }
    tokens = strtok(NULL, ", ");
    char *imm_s = tokens;
    uint64_t imm;
    if (strncmp(imm_s, "0x", 2) == 0) {
      if (!(is_hex_digits(imm_s + 2))) {
        printf("Not a valid immediate.\nPlease reset.\n");
        return INT_MIN;
      }
      imm = strtoull(imm_s, NULL, 16);
    } else {
      if (!(is_decimal_digits(imm_s))) {
        printf("Not a valid immediate.\nPlease reset.\n");
        return INT_MIN;
      }
      imm = strtoull(imm_s, NULL, 10);
    }

    if (imm > 0xFFFFF) {
      printf("Immediate is too large.\nExpected in range [0, 1048575].\nPlease "
             "reset.\n");
      return INT_MIN;
    }

    if (rd == 0) {
      return line + 4;
    }

    if (strcmp(op, "lui") == 0) {
      r_lui(rd, imm);
    } else if (strcmp(op, "auipc") == 0) {
      r_auipc(rd, imm, line);
    }
  } else if (op_type == B_TYPE) {
    if (!validate_format(instruction, 3, 1)) {
      printf("Malformed instruction.\nPlease reset.\n");
      return INT_MIN;
    }
    char *tokens = strtok(instruction, ", ");
    char *rs1_s = tokens;
    int rs1 = get_register(rs1_s);
    tokens = strtok(NULL, ", ");
    char *rs2_s = tokens;
    int rs2 = get_register(rs2_s);
    if (rs1 == -1 || rs2 == -1) {
      return INT_MIN;
    }
    tokens = strtok(NULL, ", ");
    char *imm_s = tokens;
    uint64_t imm = imm_label(imm_s);
    imm = read_offset(tokens, imm_s, imm);

    if (imm % 4 || (int64_t)imm < 0) {
      printf("Must branch to instruction that exists.\nPlease reset.\n");
      return INT_MIN;
    }

    if (strcmp(op, "beq") == 0) {
      return r_beq(rs1, rs2, imm, line);
    } else if (strcmp(op, "bne") == 0) {
      return r_bne(rs1, rs2, imm, line);
    } else if (strcmp(op, "blt") == 0) {
      return r_blt(rs1, rs2, imm, line);
    } else if (strcmp(op, "bltu") == 0) {
      return r_bltu(rs1, rs2, imm, line);
    } else if (strcmp(op, "bge") == 0) {
      return r_bge(rs1, rs2, imm, line);
    } else if (strcmp(op, "bgeu") == 0) {
      return r_bgeu(rs1, rs2, imm, line);
    } else if (strcmp(op, "bgt") == 0) {
      return r_blt(rs2, rs1, imm, line);
    } else if (strcmp(op, "bgtu") == 0) {
      return r_bltu(rs2, rs1, imm, line);
    } else if (strcmp(op, "ble") == 0) {
      return r_bge(rs2, rs1, imm, line);
    } else if (strcmp(op, "bleu") == 0) {
      return r_bgeu(rs2, rs1, imm, line);
    }
  } else if (op_type == BZ_TYPE) {
    if (!validate_format(instruction, 2, 1)) {
      printf("Malformed instruction.\nPlease reset.\n");
      return INT_MIN;
    }
    char *tokens = strtok(instruction, ", ");
    char *rs_s = tokens;
    int rs = get_register(rs_s);
    if (rs == -1) {
      return INT_MIN;
    }
    tokens = strtok(NULL, ", ");
    char *imm_s = tokens;
    uint64_t imm = imm_label(imm_s);
    imm = read_offset(tokens, imm_s, imm);

    if (imm % 4 || (int64_t)imm < 0) {
      printf("Must branch to instruction that exists.\nPlease reset.\n");
      return INT_MIN;
    }

    if (strcmp(op, "beqz") == 0) {
      return r_beq(rs, 0, imm, line);
    } else if (strcmp(op, "bnez") == 0) {
      return r_bne(rs, 0, imm, line);
    } else if (strcmp(op, "blez") == 0) {
      return r_bge(0, rs, imm, line);
    } else if (strcmp(op, "bgez") == 0) {
      return r_bge(rs, 0, imm, line);
    } else if (strcmp(op, "bltz") == 0) {
      return r_blt(rs, 0, imm, line);
    } else if (strcmp(op, "bgtz") == 0) {
      return r_blt(0, rs, imm, line);
    }
  } else if (op_type == DR_TYPE) {
    if (!validate_format(instruction, 2, 0)) {
      printf("Malformed instruction.\nPlease reset.\n");
      return INT_MIN;
    }
    char *tokens = strtok(instruction, ", ");
    char *rd_s = tokens;
    int rd = get_register(rd_s);
    tokens = strtok(NULL, ", ");
    char *rs_s = tokens;
    int rs = get_register(rs_s);
    if (rd == -1 || rs == -1) {
      return INT_MIN;
    }
    if (rd == 0) {
      return line + 4;
    }

    if (strcmp(op, "mv") == 0) {
      r_addi(rd, rs, 0);
    } else if (strcmp(op, "not") == 0) {
      r_xori(rd, rs, -1);
    } else if (strcmp(op, "neg") == 0) {
      r_sub(rd, 0, rs);
    } else if (strcmp(op, "negw") == 0) {
      r_subw(rd, 0, rs);
    } else if (strcmp(op, "sext.w") == 0) {
      r_addw(rd, rs, 0);
    } else if (strcmp(op, "seqz") == 0) {
      r_sltiu(rd, rs, 1);
    } else if (strcmp(op, "snez") == 0) {
      r_sltu(rd, 0, rs);
    } else if (strcmp(op, "sltz") == 0) {
      r_slt(rd, rs, 0);
    } else if (strcmp(op, "sgtz") == 0) {
      r_slt(rd, 0, rs);
    }
  } else if (op_type == J_TYPE) {
    if (strcmp(op, "ret") == 0) {
      if (instruction != NULL) {
        while (*instruction && isspace(*instruction)) {
          instruction++;
        }
        if (instruction[0] != '#') {
          printf("Malformed instruction.\nPlease reset.\n");
          return INT_MIN;
        }
      }
      return r_jalr(0, 1, 0, line);
    }
    int is_one = validate_format(instruction, 1, 1);
    int is_one_no = validate_format(instruction, 1, 0);
    int is_two = validate_format(instruction, 2, 1);
    int is_three = validate_format(instruction, 3, 0);
    char *tokens = strtok(instruction, ", ");
    char *first = tokens;

    if (strcmp(op, "jal") == 0) {
      tokens = strtok(NULL, ", ");
      char *second = tokens;
      if (second == NULL || second[0] == '+' || second[0] == '-') {
        if (!is_one) {
          printf("Malformed instruction.\nPlease reset.\n");
          return INT_MIN;
        }
        uint64_t imm = imm_label(first);
        imm = read_offset(tokens, first, imm);
        if (imm % 4 || (int64_t)imm < 0) {
          printf("Must branch to instruction that exists.\nPlease reset.\n");
          return INT_MIN;
        }
        return r_jal(1, imm, line);
      } else {
        if (!is_two) {
          printf("Malformed instruction.\nPlease reset.\n");
          return INT_MIN;
        }
        uint64_t imm = imm_label(second);
        imm = read_offset(tokens, second, imm);
        if (imm % 4 || (int64_t)imm < 0) {
          printf("Must branch to instruction that exists.\nPlease reset.\n");
          return INT_MIN;
        }
        int rd = lt_get(abi_map, first);
        rd = rd == -1 ? atoi(first + 1) : rd;
        return r_jal(rd, imm, line);
      }
    } else if (strcmp(op, "jalr") == 0) {
      tokens = strtok(NULL, ", ");
      char *second = tokens;
      if (second == NULL || second[0] == '#') {
        if (!is_one_no) {
          printf("Malformed instruction.\nPlease reset.\n");
          return INT_MIN;
        }
        int rs = lt_get(abi_map, first);
        rs = rs == -1 ? atoi(first + 1) : rs;
        return r_jalr(1, rs, 0, line);
      } else {
        if (!is_three) {
          printf("Malformed instruction.\nPlease reset.\n");
          return INT_MIN;
        }
        int rd = lt_get(abi_map, first);
        rd = rd == -1 ? atoi(first + 1) : rd;
        int rs = lt_get(abi_map, second);
        rs = rs == -1 ? atoi(second + 1) : rs;
        tokens = strtok(NULL, ", ");
        char *imm_s = tokens;
        uint64_t imm = imm_label(imm_s);
        if (imm % 4 || (int64_t)imm < 0) {
          printf("Must branch to instruction that exists.\nPlease reset.\n");
          return INT_MIN;
        }
        return r_jalr(rd, rs, imm, line);
      }
    } else if (strcmp(op, "jr") == 0) {
      if (!is_one_no) {
        printf("Malformed instruction.\nPlease reset.\n");
        return INT_MIN;
      }
      int rs = lt_get(abi_map, first);
      rs = rs == -1 ? atoi(first + 1) : rs;
      return r_jalr(0, rs, 0, line);
    } else {
      uint64_t imm = imm_label(first);
      imm = read_offset(tokens, first, imm);
      if (strcmp(op, "j") == 0) {
        if (!is_one) {
          printf("Malformed instruction.\nPlease reset.\n");
          return INT_MIN;
        }
        if (imm % 4 || (int64_t)imm < 0) {
          printf("Must branch to instruction that exists.\nPlease reset.\n");
          return INT_MIN;
        }
        return r_jal(0, imm, line);
      }
    }
  } else {
    printf("Illegal instruction.\nPlease reset.\n");
    printf("%s", inst_copy);
    return INT_MIN;
  }
  return line + 4;
}

// Two functions for setting up r5 code environment:
EMSCRIPTEN_KEEPALIVE void set_register(uint8_t register_id, uint64_t value) {
  registers[register_id] = value;
}

EMSCRIPTEN_KEEPALIVE
void set_memory(uint64_t location, uint64_t value) {
  ht_insert(memory, location, value);
}

int main(int argc, char *argv[]) { return 0; }

EMSCRIPTEN_KEEPALIVE
int prepare_code() {
  memory = ht_init();
  labels = lt_init();
  abi_map = lt_init();
  char abis[32][5] = {"zero", "ra", "sp",  "gp",  "tp", "t0", "t1", "t2",
                      "s0",   "s1", "a0",  "a1",  "a2", "a3", "a4", "a5",
                      "a6",   "a7", "s2",  "s3",  "s4", "s5", "s6", "s7",
                      "s8",   "s9", "s10", "s11", "t3", "t4", "t5", "t6"};
  char defs[32][4] = {"x0",  "x1",  "x2",  "x3",  "x4",  "x5",  "x6",  "x7",
                      "x8",  "x9",  "x10", "x11", "x12", "x13", "x14", "x15",
                      "x16", "x17", "x18", "x19", "x20", "x21", "x22", "x23",
                      "x24", "x25", "x26", "x27", "x28", "x29", "x30", "x31"};

  for (int i = 0; i < 32; ++i) {
    lt_insert(abi_map, defs[i], i);
    lt_insert(abi_map, abis[i], i);
  }
  lt_insert(abi_map, "fp", 8);

  FILE *user_asm = fopen("input.asm", "r");
  if (!user_asm) {
    printf("The provided file, input.asm, is invalid.\n");
    return 1;
  }

  total_lines = 0;
  char line[256];
  while (fgets(line, sizeof(line), user_asm)) {
    total_lines++;
  }

  code_lines = malloc(total_lines * sizeof(char *));

  rewind(user_asm);

  int line_index = 0;
  while (fgets(line, sizeof(line), user_asm)) {
    int len = strlen(line);
    if (len > 0 && line[len - 1] == '\n') {
      line[len - 1] = '\0';
    }

    code_lines[line_index] = malloc(len + 1);
    strcpy(code_lines[line_index], line);
    line_index++;
  }

  fclose(user_asm);

  pass(code_lines, total_lines);

  return 0;
}

int run_code() {
  if (sim_PC >= user_instruction_count * 4 || sim_PC < 0)
    return sim_PC;
  int index = sim_PC / 4;
  char buffer[256];
  strcpy(buffer, user_instructions[index].instruction);
  printf("[line %d] %s", user_instructions[index].source_line,
         user_instructions[index].instruction);
  for (int i = 0; buffer[i]; ++i) {
    buffer[i] = tolower(buffer[i]);
  }
  sim_PC = step(buffer, sim_PC);
  // Synchronize registers:
  if (sim_PC != INT_MIN) {
    for (int i = 0; i < 32; i++) {
      EM_ASM({ interpreter.set_register($0, BigInt($1)); }, i, registers[i]);
    }
  }
  // Todo: memory management
  return sim_PC;
}

void free_code() {
  for (int i = 0; i < total_lines; ++i) {
    free(code_lines[i]);
  }
  free(code_lines);
  ht_free(memory);
  lt_free(abi_map);
  lt_free(labels);
  sim_PC = 0;
}