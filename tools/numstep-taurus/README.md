# Numstep Taurus tools

This directory contains the Taurus variant generator.

The implementation is based on Numstep Classic. Its defining change is the neighbour model:

- north from row 0 wraps to row n-1;
- south from row n-1 wraps to row 0;
- west from column 0 wraps to column n-1;
- east from column n-1 wraps to column 0.

The same topology is used during generation and solution uniqueness checking.
