#pragma once
#include "hash_table.h"
#include "instructions.h"
#include "label_table.h"
#include <ctype.h>
#include <inttypes.h>
#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

const int R_TYPE = 0;
const int I_TYPE = 1;
const int MEM_TYPE = 2;
const int U_TYPE = 3;
const int B_TYPE = 4;
const int BZ_TYPE = 5;
const int DR_TYPE = 6;
const int J_TYPE = 7;
const int UNKNOWN_TYPE = 8;

/**
 * This function was written by the 3410 staff from a previous semester, and the
 * arrays have been modified + more 'types' for supporting pseudoinstructions
 * and jumps have been added Return the type of instruction for the given
 * operation
 */
static int get_op_type(char *op) {
  const char *r_type_op[] = {"add",  "sub",  "and",  "or",   "xor",
                             "slt",  "sltu", "sll",  "sra",  "srl",
                             "addw", "sllw", "srlw", "subw", "sraw"};
  const char *i_type_op[] = {"addi",  "andi",  "ori",   "xori", "slti",
                             "addiw", "slli",  "slliw", "srli", "srliw",
                             "srai",  "sraiw", "sltiu"};
  const char *mem_type_op[] = {"ld", "lw", "lh", "lb", "sd", "sw", "sh", "sb"};
  const char *u_type_op[] = {"lui", "auipc"};
  const char *b_type_op[] = {"beq",  "bne", "blt",  "bltu", "bge",
                             "bgeu", "bgt", "bgtu", "ble",  "bleu"};
  const char *bz_type_op[] = {"beqz", "bnez", "blez", "bgez", "bltz", "bgtz"};
  const char *dr_type_op[] = {"mv",   "not",  "neg",  "negw", "sext.w",
                              "seqz", "snez", "sltz", "sgtz"};
  const char *j_type_op[] = {"jal", "jalr", "j", "jr", "ret"};
  for (int i = 0; i < (int)(sizeof(r_type_op) / sizeof(char *)); i++) {
    if (strcmp(r_type_op[i], op) == 0) {
      return R_TYPE;
    }
  }
  for (int i = 0; i < (int)(sizeof(i_type_op) / sizeof(char *)); i++) {
    if (strcmp(i_type_op[i], op) == 0) {
      return I_TYPE;
    }
  }
  for (int i = 0; i < (int)(sizeof(mem_type_op) / sizeof(char *)); i++) {
    if (strcmp(mem_type_op[i], op) == 0) {
      return MEM_TYPE;
    }
  }
  for (int i = 0; i < (int)(sizeof(u_type_op) / sizeof(char *)); i++) {
    if (strcmp(u_type_op[i], op) == 0) {
      return U_TYPE;
    }
  }
  for (int i = 0; i < (int)(sizeof(b_type_op) / sizeof(char *)); i++) {
    if (strcmp(b_type_op[i], op) == 0) {
      return B_TYPE;
    }
  }
  for (int i = 0; i < (int)(sizeof(bz_type_op) / sizeof(char *)); i++) {
    if (strcmp(bz_type_op[i], op) == 0) {
      return BZ_TYPE;
    }
  }
  for (int i = 0; i < (int)(sizeof(dr_type_op) / sizeof(char *)); i++) {
    if (strcmp(dr_type_op[i], op) == 0) {
      return DR_TYPE;
    }
  }
  for (int i = 0; i < (int)(sizeof(j_type_op) / sizeof(char *)); i++) {
    if (strcmp(j_type_op[i], op) == 0) {
      return J_TYPE;
    }
  }
  return UNKNOWN_TYPE;
}

typedef struct {
  char *instruction;
  int source_line;
} inst;

inst *user_instructions;
int user_instruction_count = 0;

int blank_or_comment(char *line) {
  while (*line && isspace(*line))
    line++;
  return *line == '\0' || *line == '#';
}

void pass(char **user_assembly, int line_count) {
  int current_address = 0;
  user_instructions = (inst *)malloc(line_count * sizeof(inst));

  for (int i = 0; i < line_count; ++i) {
    char *line = user_assembly[i];

    if (blank_or_comment(line)) {
      continue;
    }

    char *colon = strchr(line, ':');
    if (colon) {
      *colon = '\0';
      lt_insert(labels, line, current_address);
      line = colon + 1;
      continue;
    }

    int index = current_address / 4;
    user_instructions[index].instruction = strdup(line);
    user_instructions[index].source_line = i;
    user_instruction_count++;
    current_address += 4;
  }
}

int is_decimal_digits(const char *str) {
  if (!isdigit(str[0])) {
    if (str[0] != '-' || !isdigit(str[1])) {
      return 0;
    } else {
      str++;
    }
  }
  while (*str) {
    if (!isdigit(*str)) {
      return 0;
    }
    str++;
  }
  return 1;
}

int is_hex_digits(const char *str) {
  while (*str) {
    if (!isxdigit(*str)) {
      return 0;
    }
    str++;
  }
  return 1;
}

uint64_t imm_label(char *imm_s) {
  uint64_t imm = INT_MIN;
  int branch_line = lt_get(labels, imm_s);
  if (branch_line == -1) {
    if (strncmp(imm_s, "0x", 2) == 0 && is_hex_digits(imm_s + 2)) {
      imm = strtoull(imm_s, NULL, 16);
    } else if (is_decimal_digits(imm_s)) {
      imm = strtoull(imm_s, NULL, 10);
    }
  } else {
    imm = branch_line;
  }
  return imm;
}

uint64_t read_offset(char *tokens, char *imm_s, uint64_t imm) {
  char *etokens = strdup(tokens);
  if (lt_get(labels, imm_s) != -1) {
    tokens = strtok(NULL, "+ ");
    if (tokens != NULL) {
      uint64_t inc_imm = imm_label(tokens);
      if (inc_imm == (uint64_t)INT_MIN) {
        etokens = strtok(NULL, "- ");
        if (etokens != NULL) {
          uint64_t dec_imm = imm_label(etokens);
          imm = dec_imm != (uint64_t)INT_MIN ? imm - dec_imm : imm;
        }
      } else {
        imm += inc_imm;
      }
    }
  }
  return imm;
}

int validate_parentheses_format(const char *str) {
  int commas = 0;
  int open_paren = 0;
  int close_paren = 0;
  int has_hash = 0;
  int items = 0;
  int in_item = 0;

  while (isspace(*str)) {
    str++;
  }

  while (*str) {
    if (*str == ',') {
      if (!in_item || items != 1 || open_paren) {
        return 0;
      }
      commas++;
      in_item = 0;
    } else if (*str == '(') {
      if (items != 2 || open_paren) {
        return 0;
      }
      open_paren = 1;
      in_item = 0;
    } else if (*str == ')') {
      if (!open_paren || !in_item) {
        return 0;
      }
      close_paren = 1;
      in_item = 0;
    } else if (*str == '#') {
      if (commas != 1 || !close_paren || (items > 3 && has_hash == 0)) {
        return 0;
      }
      items++;
      has_hash = 1;
      in_item = 0;
    } else if (!isspace(*str)) {
      if (!in_item) {
        items++;
        in_item = 1;
      }
    } else {
      in_item = 0;
    }
    str++;
  }

  return (commas == 1 && open_paren && close_paren &&
          ((has_hash && items >= 4) || (!has_hash && items == 3)));
}

int validate_format(const char *str, int expected_items, int beq) {
  int commas = 0;
  int items = 0;
  int has_hash = 0;
  int in_item = 0;
  int ignore_commas = 0;
  int has_arith = 0;

  while (isspace(*str)) {
    str++;
  }

  while (*str) {
    if (*str == ',') {
      if (ignore_commas) {
        str++;
        continue;
      }
      if (!in_item) {
        return 0;
      }
      commas++;
      in_item = 0;
    } else if (*str == '#') {
      if (commas != expected_items - 1 ||
          (items > expected_items && !has_arith)) {
        return 0;
      }
      has_hash = 1;
      ignore_commas = 1;
      in_item = 0;
    } else if ((*str == '+' || *str == '-') && beq) {
      if (commas != expected_items - 1 || has_arith) {
        return 0;
      }
      has_arith = 1;
      in_item = 0;
    } else if (!isspace(*str)) {
      if (!in_item) {
        items++;
      }
      in_item = 1;
    } else {
      in_item = 0;
    }
    str++;
  }

  if (has_hash) {
    return (commas == expected_items - 1 && items >= expected_items);
  } else if (beq && has_arith) {
    return (commas == expected_items - 1 && items == expected_items + 1);
  } else {
    return (commas == expected_items - 1 && items == expected_items);
  }
}

int get_register(char *str) {
  int reg = lt_get(abi_map, str);
  if (reg == -1) {
    printf("Malformed instruction.\nPlease reset.\n");
    return -1;
  }
  return reg;
}
