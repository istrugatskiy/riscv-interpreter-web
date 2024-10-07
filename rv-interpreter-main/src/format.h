#pragma once
#include "instructions.h"
#include <algorithm>
#include <cstddef>
#include <cstdint>
#include <ctype.h>
#include <inttypes.h>
#include <iostream>
#include <limits.h>
#include <ostream>
#include <regex>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>

enum InstructionType {
  R_TYPE,
  I_TYPE,
  MEM_TYPE,
  U_TYPE,
  B_TYPE,
  BZ_TYPE,
  DR_TYPE,
  J_TYPE,
  UNKNOWN_TYPE
};

typedef struct {
  std::string original;
  std::string parsed;
  size_t source_line;
} inst;

std::vector<inst> user_instructions;

int64_t handle_error(const inst instruction, const std::string error_msg) {
  std::cout << "Fatal error on line " << instruction.source_line << std::endl;
  std::cout << error_msg << " @ " << instruction.original << std::endl;
  std::cout << "Reset the interpreter!" << std::endl;
  return INT64_MIN;
}

static InstructionType get_op_type(std::string op) {
  // Todo: mul should be in it's own category.
  const std::unordered_set<std::string> r_type_op{
      "add", "sub", "and",  "or",   "xor",  "slt",  "sltu", "sll",
      "sra", "srl", "addw", "sllw", "srlw", "subw", "sraw", "mul"};
  const std::unordered_set<std::string> i_type_op{
      "addi",  "andi", "ori",   "xori", "slti",  "addiw", "slli",
      "slliw", "srli", "srliw", "srai", "sraiw", "sltiu"};
  const std::unordered_set<std::string> mem_type_op{"ld", "lw", "lh", "lb",
                                                    "sd", "sw", "sh", "sb"};
  const std::unordered_set<std::string> u_type_op{"lui", "auipc"};
  const std::unordered_set<std::string> b_type_op{
      "beq", "bne", "blt", "bltu", "bge", "bgeu", "bgt", "bgtu", "ble", "bleu"};
  const std::unordered_set<std::string> bz_type_op{"beqz", "bnez", "blez",
                                                   "bgez", "bltz", "bgtz"};
  const std::unordered_set<std::string> dr_type_op{
      "mv", "not", "neg", "negw", "sext.w", "seqz", "snez", "sltz", "sgtz"};
  const std::unordered_set<std::string> j_type_op{"jal", "jalr", "j", "jr",
                                                  "ret"};
  if (r_type_op.contains(op))
    return R_TYPE;
  if (i_type_op.contains(op))
    return I_TYPE;
  if (mem_type_op.contains(op))
    return MEM_TYPE;
  if (u_type_op.contains(op))
    return U_TYPE;
  if (b_type_op.contains(op))
    return B_TYPE;
  if (bz_type_op.contains(op))
    return BZ_TYPE;
  if (dr_type_op.contains(op))
    return DR_TYPE;
  if (j_type_op.contains(op))
    return J_TYPE;
  return UNKNOWN_TYPE;
}

inline void ltrim(std::string &s) {
  s.erase(s.begin(), std::find_if(s.begin(), s.end(), [](unsigned char ch) {
            return !std::isspace(ch);
          }));
}

inline void rtrim(std::string &s) {
  s.erase(std::find_if(s.rbegin(), s.rend(),
                       [](unsigned char ch) { return !std::isspace(ch); })
              .base(),
          s.end());
}

/**
 * The goal of pass is to remove comments from lines, trim them, and construct a
 * label table. The processed instructions are all lowercase.
 */
void pass(std::vector<std::string> lines) {
  uint64_t current_address = 0;
  size_t source_line = 0;
  for (const std::string line : lines) {
    size_t comment = line.find('#');
    std::string line_no_comment = line;
    if (comment != std::string::npos) {
      line_no_comment = line_no_comment.substr(0, comment);
    }
    std::transform(line_no_comment.begin(), line_no_comment.end(),
                   line_no_comment.begin(), ::tolower);
    ltrim(line_no_comment);
    rtrim(line_no_comment);
    size_t label_offset = line_no_comment.find(':');
    if (label_offset != std::string::npos) {
      std::string label = line_no_comment.substr(0, label_offset);
      labels[label] = current_address;
    } else {
      user_instructions.push_back(inst{.original = line,
                                       .parsed = line_no_comment,
                                       .source_line = source_line});
      current_address += 4;
    }
    source_line++;
  }
}

bool is_decimal_digits(const std::string str) {
  const static std::regex integer_regex("^-?\\d+$");
  return std::regex_match(str, integer_regex);
}

bool is_hex_digits(const std::string str) {
  return str.find_first_not_of("0123456789abcdefABCDEF") == std::string::npos;
}

uint64_t imm_label(const std::string imm_s) {
  if (labels.contains(imm_s))
    return labels[imm_s];

  if (imm_s.starts_with("0x") && imm_s.length() > 2 &&
      is_hex_digits(imm_s.substr(2))) {
    return std::stoull(imm_s);
  } else if (is_decimal_digits(imm_s)) {
    return std::stoull(imm_s);
  }
  return INT_MIN;
}

uint64_t read_offset(std::vector<std::string> tokens, std::string imm_s,
                     uint64_t imm) {
  char *etokens = strdup(tokens);
  if (!labels.contains(imm_s))
    return imm;
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

int64_t get_register(std::string str, const inst instruction) {
  if (!labels.contains(str)) {
    return handle_error(instruction, str + " is not a valid register name");
  }
  return labels[str];
}
